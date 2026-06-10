const supabase = require("../config/supabase");
const { scrapeAllSources } = require("../services/scraperService");
const { scoreListings } = require("../services/scoringService");
const { tailorListings } = require("../services/tailoringService");

const isDev = process.env.NODE_ENV !== "production";

// ─── helpers ─────────────────────────────────────────────────────────────────

const createRun = async (triggeredBy, userId) => {
  const { data, error } = await supabase
    .from("search_runs")
    .insert({ triggered_by: triggeredBy, status: "running", user_id: userId })
    .select()
    .single();
  if (error) throw new Error(`Could not create search run: ${error.message}`);
  return data;
};

const updateRun = async (runId, patch) => {
  await supabase.from("search_runs").update(patch).eq("id", runId);
};

const failRun = async (runId, message) => {
  await updateRun(runId, {
    status: "failed",
    error_message: message,
    completed_at: new Date().toISOString(),
  });
};

// ─── pipeline ────────────────────────────────────────────────────────────────

const runPipeline = async (runId, userId) => {
  try {
    console.log(`[Run ${runId}] Starting scrape for user ${userId}...`);
    const scraped = await scrapeAllSources(runId, userId);
    await updateRun(runId, { jobs_scraped: scraped.length });
    console.log(`[Run ${runId}] Scraped ${scraped.length} new listings.`);

    if (scraped.length > 0) {
      const listingIds = scraped.map((l) => l.id);
      console.log(`[Run ${runId}] Scoring ${listingIds.length} listings...`);
      const qualified = await scoreListings(listingIds, runId, userId);
      console.log(`[Run ${runId}] ${qualified.length} listings qualified for tailoring.`);

      if (qualified.length > 0) {
        console.log(`[Run ${runId}] Tailoring ${qualified.length} listings...`);
        const tailored = await tailorListings(qualified, runId, userId);
        console.log(`[Run ${runId}] ${tailored} applications created and pending review.`);
      }
    } else {
      console.log(`[Run ${runId}] No new listings to score.`);
    }

    await updateRun(runId, {
      status: "completed",
      completed_at: new Date().toISOString(),
    });

    console.log(`[Run ${runId}] Pipeline complete.`);
  } catch (err) {
    console.error(`[Run ${runId}] Pipeline failed:`, err.message);
    await failRun(runId, err.message);
  }
};

// ─── controllers ─────────────────────────────────────────────────────────────

// POST /api/agent/run
const triggerRun = async (req, res) => {
  try {
    const userId = req.user.id;
    const run = await createRun("manual", userId);

    runPipeline(run.id, userId).catch((err) =>
      console.error("Unhandled pipeline error:", err.message)
    );

    return res.status(202).json({
      success: true,
      message: "Pipeline started.",
      runId: run.id,
    });
  } catch (err) {
    console.error("Trigger run error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Failed to start pipeline.",
      ...(isDev && { details: err.message }),
    });
  }
};

// GET /api/agent/status/:runId
const getRunStatus = async (req, res) => {
  try {
    const { runId } = req.params;
    const userId = req.user.id;

    const { data: run, error } = await supabase
      .from("search_runs")
      .select("*")
      .eq("id", runId)
      .eq("user_id", userId)
      .single();

    if (error || !run) {
      return res.status(404).json({ success: false, error: "Run not found." });
    }

    return res.json({ success: true, data: run });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to fetch run status.",
      ...(isDev && { details: err.message }),
    });
  }
};

// GET /api/agent/runs
const listRuns = async (req, res) => {
  try {
    const userId = req.user.id;

    const { data: runs, error } = await supabase
      .from("search_runs")
      .select("*")
      .eq("user_id", userId)
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) throw new Error(error.message);

    return res.json({ success: true, data: runs });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: "Failed to list runs.",
      ...(isDev && { details: err.message }),
    });
  }
};

module.exports = { triggerRun, getRunStatus, listRuns, runPipeline, createRun, updateRun, failRun };
