const { ApifyClient } = require("apify-client");
const supabase = require("../config/supabase");

const getClient = () => {
  if (!process.env.APIFY_API_TOKEN) {
    throw new Error("APIFY_API_TOKEN is missing. Add it to Backend/.env");
  }
  return new ApifyClient({ token: process.env.APIFY_API_TOKEN });
};

// ─── LinkedIn ────────────────────────────────────────────────────────────────
// Builds LinkedIn job search URLs from role + location pairs.
// Uses the public (non-logged-in) search page.
// LinkedIn geo IDs for common locations
const LINKEDIN_GEO_IDS = {
  "united states": "103644278",
  "us": "103644278",
  "new york": "105080838",
  "new york, ny": "105080838",
  "san francisco": "90000084",
  "los angeles": "102448103",
  "chicago": "103112676",
  "austin": "107577833",
  "seattle": "105506630",
  "boston": "101002974",
  "remote": null, // handled via f_WT=2
};

const buildLinkedInUrls = (targetRoles, targetLocations) => {
  const urls = [];
  for (const role of targetRoles) {
    for (const location of targetLocations) {
      const isRemote = location.toLowerCase() === "remote";
      const geoId = LINKEDIN_GEO_IDS[location.toLowerCase()];

      const params = new URLSearchParams({
        keywords: role,
        f_TPR: "r86400", // posted in last 24h
        position: 1,
        pageNum: 0,
      });

      // Remote filter
      if (isRemote) params.set("f_WT", "2");

      // Geo ID for non-remote locations
      if (!isRemote && geoId) {
        params.set("geoId", geoId);
      } else if (!isRemote) {
        // Fall back to text-based location
        params.set("location", location);
      }

      urls.push(`https://www.linkedin.com/jobs/search/?${params.toString()}`);
    }
  }
  return urls;
};

// Scrapers can return company/location as objects — always extract the name string
const extractName = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    try { return JSON.parse(val)?.name ?? val; } catch { return val; }
  }
  if (typeof val === "object") return val.name || val.displayName || "";
  return String(val);
};

const normalizeLinkedIn = (item) => ({
  source: "linkedin",
  url: item.jobUrl || item.url || item.link || "",
  title: item.title || item.jobTitle || "",
  company: extractName(item.companyName || item.company || ""),
  location: extractName(item.location || ""),
  job_type: item.contractType || item.jobType || null,
  salary_range: item.salary || null,
  description: item.descriptionText || item.description || "",
  posted_at: item.postedAt ? new Date(item.postedAt).toISOString() : null,
});

const scrapeLinkedIn = async (client, targetRoles, targetLocations, maxPerSearch = 25) => {
  console.log("Scraping LinkedIn...");
  const urls = buildLinkedInUrls(targetRoles, targetLocations);

  const run = await client.actor("curious_coder/linkedin-jobs-scraper").call({
    urls,
    count: maxPerSearch,
    scrapeCompany: false,
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();
  console.log(`LinkedIn: ${items.length} raw results`);
  return items.map(normalizeLinkedIn).filter((j) => j.url && j.title && j.description);
};

// ─── Indeed ──────────────────────────────────────────────────────────────────
const normalizeIndeed = (item) => ({
  source: "indeed",
  url: item.url || item.jobUrl || item.applyUrl || "",
  title: item.title || item.jobTitle || "",
  company: extractName(item.company || item.companyName || ""),
  location: extractName(item.location || ""),
  job_type: item.jobType || item.contractType || null,
  salary_range: item.salary || item.salaryText || null,
  description: item.description || item.jobDescription || "",
  posted_at: (item.postedAt || item.date) ? new Date(item.postedAt || item.date).toISOString() : null,
});

const scrapeIndeed = async (client, targetRoles, targetLocations, maxPerSearch = 25) => {
  console.log("Scraping Indeed...");
  const results = [];

  for (const role of targetRoles) {
    for (const location of targetLocations) {
      try {
        const run = await client.actor("valig/indeed-jobs-scraper").call({
          title: role,
          location: location === "Remote" ? "remote" : location,
          country: "us",
          datePosted: "1", // last 24h
          limit: maxPerSearch,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        results.push(...items);
      } catch (err) {
        console.error(`Indeed scrape failed for "${role}" / "${location}":`, err.message);
      }
    }
  }

  console.log(`Indeed: ${results.length} raw results`);
  return results.map(normalizeIndeed).filter((j) => j.url && j.title && j.description);
};

// ─── Glassdoor ───────────────────────────────────────────────────────────────
const normalizeGlassdoor = (item) => ({
  source: "glassdoor",
  url: item.jobLink || item.url || item.applyUrl || "",
  title: item.jobTitle || item.title || "",
  company: extractName(item.employer || item.company || item.companyName || ""),
  location: extractName(item.location || ""),
  job_type: item.employmentType || item.jobType || null,
  salary_range: item.salaryRange || item.salary || null,
  description: item.description || item.jobDescription || "",
  posted_at: item.listed || item.postedAt ? new Date(item.listed || item.postedAt).toISOString() : null,
});

const scrapeGlassdoor = async (client, targetRoles, targetLocations, maxPerSearch = 25) => {
  console.log("Scraping Glassdoor...");
  const results = [];

  for (const role of targetRoles) {
    for (const location of targetLocations) {
      try {
        const run = await client.actor("valig/glassdoor-jobs-scraper").call({
          keywords: role,
          location: location === "Remote" ? "Remote" : location,
          daysOld: 1,
          limit: maxPerSearch,
        });

        const { items } = await client.dataset(run.defaultDatasetId).listItems();
        results.push(...items);
      } catch (err) {
        console.error(`Glassdoor scrape failed for "${role}" / "${location}":`, err.message);
      }
    }
  }

  console.log(`Glassdoor: ${results.length} raw results`);
  return results.map(normalizeGlassdoor).filter((j) => j.url && j.title && j.description);
};

// ─── Dedup + Save ────────────────────────────────────────────────────────────

// Deduplicates within the batch, then upserts per-user (user_id, url) unique key.
const deduplicateAndSave = async (listings, searchRunId, userId) => {
  if (listings.length === 0) return [];

  // Step 1: deduplicate within the current batch
  const seenUrls = new Set();
  const uniqueListings = listings.filter((l) => {
    if (seenUrls.has(l.url)) return false;
    seenUrls.add(l.url);
    return true;
  });
  console.log(`After in-batch dedup: ${uniqueListings.length} (was ${listings.length})`);

  // Step 2: upsert — (user_id, url) conflict = skip silently
  const rows = uniqueListings.map((l) => ({ ...l, search_run_id: searchRunId, user_id: userId }));

  const { data: inserted, error } = await supabase
    .from("job_listings")
    .upsert(rows, { onConflict: "user_id,url", ignoreDuplicates: true })
    .select("id, title, company, source");

  if (error) {
    throw new Error(`Failed to insert job listings: ${error.message}`);
  }

  console.log(`Saved ${inserted.length} new listings to DB.`);
  return inserted;
};

// ─── Main Export ─────────────────────────────────────────────────────────────

/**
 * Scrape all sources for the given user.
 * Returns the newly inserted job_listing rows.
 */
const scrapeAllSources = async (searchRunId, userId, options = {}) => {
  const { data: profile, error } = await supabase
    .from("user_profile")
    .select("target_roles, target_locations")
    .eq("user_id", userId)
    .single();

  if (error || !profile) {
    throw new Error("No user_profile found for this user.");
  }

  const { target_roles: targetRoles, target_locations: targetLocations } = profile;
  // LinkedIn actor requires count >= 10; use 10 as the minimum
  const maxPerSearch = Math.max(options.maxPerSearch || 10, 10);

  const client = getClient();
  const allListings = [];

  const scrapers = [
    { name: "LinkedIn",  fn: () => scrapeLinkedIn(client, targetRoles, targetLocations, maxPerSearch)  },
    { name: "Indeed",    fn: () => scrapeIndeed(client, targetRoles, targetLocations, maxPerSearch)    },
    { name: "Glassdoor", fn: () => scrapeGlassdoor(client, targetRoles, targetLocations, maxPerSearch) },
  ];

  for (const scraper of scrapers) {
    try {
      const listings = await scraper.fn();
      allListings.push(...listings);
    } catch (err) {
      console.error(`${scraper.name} scraper failed:`, err.message);
    }
  }

  console.log(`Total raw listings across all sources: ${allListings.length}`);

  const saved = await deduplicateAndSave(allListings, searchRunId, userId);
  return saved;
};

module.exports = { scrapeAllSources };
