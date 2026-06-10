const supabase = require("../config/supabase");
const { generateTailoredResume, generateCoverLetter } = require("./aiSharedService");
const { batchRun } = require("../utils/batchRun");

const BATCH_SIZE = 3;

/**
 * Tailor resume + cover letter for each qualifying listing for a specific user.
 * Also catches stragglers: qualified matches with no application yet.
 */
const tailorListings = async (qualified, searchRunId, userId) => {
  // Find qualified matches with no application yet (stragglers)
  const { data: alreadyTailored } = await supabase
    .from("applications")
    .select("listing_id")
    .eq("user_id", userId);

  const tailoredIds = (alreadyTailored || []).map((r) => r.listing_id);

  let stragglersQuery = supabase
    .from("job_matches")
    .select("listing_id, match_score, decision, analysis")
    .eq("user_id", userId)
    .in("decision", ["APPLY", "APPLY_WITH_CAUTION"]);

  if (tailoredIds.length > 0) {
    stragglersQuery = stragglersQuery.not(
      "listing_id", "in",
      `(${tailoredIds.map((id) => `"${id}"`).join(",")})`
    );
  }

  const { data: stragglers } = await stragglersQuery;

  const stragglersFormatted = (stragglers || []).map((s) => ({
    listing: { id: s.listing_id },
    matchScore: s.match_score,
    decision: s.decision,
    analysis: s.analysis,
  }));

  const seenIds = new Set((qualified || []).map((q) => q.listing.id));
  for (const s of stragglersFormatted) {
    if (!seenIds.has(s.listing.id)) {
      qualified = [...(qualified || []), s];
      seenIds.add(s.listing.id);
    }
  }

  // Fetch full listing data for stragglers (only have id)
  const needsFullData = qualified.filter((q) => !q.listing.description);
  if (needsFullData.length > 0) {
    const ids = needsFullData.map((q) => q.listing.id);
    const { data: fullListings } = await supabase
      .from("job_listings")
      .select("id, title, company, description, location, source")
      .eq("user_id", userId)
      .in("id", ids);
    const listingMap = Object.fromEntries((fullListings || []).map((l) => [l.id, l]));
    qualified = qualified.map((q) =>
      q.listing.description ? q : { ...q, listing: { ...q.listing, ...listingMap[q.listing.id] } }
    );
  }

  qualified = qualified.filter((q) => q.listing.description);

  if (!qualified || qualified.length === 0) {
    console.log("No qualified listings to tailor.");
    return 0;
  }

  const { data: profile, error: profileError } = await supabase
    .from("user_profile")
    .select("resume_text")
    .eq("user_id", userId)
    .single();

  if (profileError || !profile) {
    throw new Error("No user_profile found. Cannot tailor listings.");
  }

  const { resume_text: resume } = profile;
  console.log(`Tailoring ${qualified.length} listings in batches of ${BATCH_SIZE}...`);

  let successCount = 0;
  let failCount = 0;

  const tasks = qualified.map(({ listing, matchScore, decision, analysis }) => async () => {
    try {
      const tailoredResume = await generateTailoredResume(listing.description, resume, analysis);
      const coverLetterResult = await generateCoverLetter(listing.description, resume, analysis, tailoredResume);

      const { error: insertError } = await supabase
        .from("applications")
        .insert({
          listing_id: listing.id,
          user_id: userId,
          status: "pending_review",
          tailored_resume: tailoredResume,
          cover_letter: coverLetterResult.coverLetter || "",
          notes: `Score: ${matchScore}% | Decision: ${decision}`,
        });

      if (insertError) {
        if (insertError.code === "23505") {
          console.log(`Application already exists: ${listing.title} @ ${listing.company}`);
          return null;
        }
        throw new Error(insertError.message);
      }

      successCount++;
      console.log(`Tailored: ${listing.title} @ ${listing.company} (${matchScore}%)`);
      return { listing, matchScore };
    } catch (err) {
      failCount++;
      console.error(`Failed to tailor "${listing.title}":`, err.message);
      return null;
    }
  });

  await batchRun(tasks, BATCH_SIZE, 2000);

  console.log(`Tailoring complete: ${successCount} applications created, ${failCount} failed.`);

  await supabase
    .from("search_runs")
    .update({ jobs_tailored: successCount })
    .eq("id", searchRunId);

  return successCount;
};

module.exports = { tailorListings };
