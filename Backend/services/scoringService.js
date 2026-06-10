const supabase = require("../config/supabase");
const { analyzeCV } = require("./aiSharedService");
const { batchRun } = require("../utils/batchRun");

const BATCH_SIZE = 5;

/**
 * Score listings for a specific user.
 * Picks up current run's new listings + any unscored stragglers from crashed runs.
 * Returns qualifying listings (score >= min_score).
 */
const scoreListings = async (listingIds, searchRunId, userId) => {
  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("resume_text, min_score, target_roles")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error("No user_profile found. Cannot score listings.");
  }

  const { resume_text: resume, min_score: minScore, target_roles: targetRoles } = profile;

  const roleKeywords = [...new Set(
    (targetRoles || []).flatMap((r) => r.toLowerCase().split(/\s+/))
  )].filter((w) => w.length > 3);

  // Get already-scored listing IDs for this user
  const { data: alreadyScored } = await supabase
    .from("job_matches")
    .select("listing_id")
    .eq("user_id", userId);

  const scoredIds = (alreadyScored || []).map((r) => r.listing_id);

  // Find unscored listings for this user
  let unscoredQuery = supabase
    .from("job_listings")
    .select("id")
    .eq("user_id", userId);

  if (scoredIds.length > 0) {
    unscoredQuery = unscoredQuery.not("id", "in", `(${scoredIds.map((id) => `"${id}"`).join(",")})`);
  }

  const { data: unscoredAll, error: unscoredError } = await unscoredQuery;
  if (unscoredError) throw new Error(`Failed to query unscored listings: ${unscoredError.message}`);

  const allIds = [...new Set([
    ...(listingIds || []),
    ...(unscoredAll || []).map((r) => r.id),
  ])];

  if (allIds.length === 0) {
    console.log("No listings to score.");
    return [];
  }

  const { data: listings, error: listingsError } = await supabase
    .from("job_listings")
    .select("id, title, company, description, location, source")
    .eq("user_id", userId)
    .in("id", allIds);

  if (listingsError) throw new Error(`Failed to fetch listings: ${listingsError.message}`);
  if (!listings || listings.length === 0) {
    console.log("No listings to score.");
    return [];
  }

  // Title pre-filter
  const relevant = roleKeywords.length > 0
    ? listings.filter((l) => {
        const title = l.title.toLowerCase();
        return roleKeywords.some((kw) => title.includes(kw));
      })
    : listings;

  const dropped = listings.length - relevant.length;
  if (dropped > 0) {
    console.log(`Title pre-filter: kept ${relevant.length}/${listings.length} (dropped ${dropped} unrelated).`);
  }

  if (relevant.length === 0) {
    console.log("No relevant listings after title filter.");
    return [];
  }

  console.log(`Scoring ${relevant.length} listings in batches of ${BATCH_SIZE}...`);

  let successCount = 0;
  let failCount = 0;

  const tasks = relevant.map((listing) => async () => {
    try {
      const analysis = await analyzeCV(listing.description, resume);

      const rawScore = analysis.matchScore || "0";
      const matchScore = parseInt(String(rawScore).replace(/[^0-9]/g, ""), 10) || 0;
      const decision = analysis.decision || "SKIP";

      const { error: insertError } = await supabase
        .from("job_matches")
        .insert({ listing_id: listing.id, user_id: userId, match_score: matchScore, decision, analysis });

      if (insertError) {
        if (insertError.code === "23505") {
          console.log(`Already scored: ${listing.title} @ ${listing.company}`);
          return null;
        }
        throw new Error(insertError.message);
      }

      successCount++;
      console.log(`[${matchScore}%] ${decision} — ${listing.title} @ ${listing.company}`);
      return { listing, matchScore, decision, analysis };
    } catch (err) {
      failCount++;
      console.error(`Failed to score "${listing.title}":`, err.message);
      return null;
    }
  });

  const results = await batchRun(tasks, BATCH_SIZE);

  const qualified = results
    .filter((r) => r.status === "fulfilled" && r.value !== null)
    .map((r) => r.value)
    .filter((r) => r.matchScore >= minScore && r.decision !== "SKIP");

  console.log(`Scoring complete: ${successCount} scored, ${failCount} failed, ${qualified.length} qualified.`);

  await supabase
    .from("search_runs")
    .update({ jobs_scored: successCount, jobs_queued: qualified.length })
    .eq("id", searchRunId);

  return qualified;
};

module.exports = { scoreListings };
