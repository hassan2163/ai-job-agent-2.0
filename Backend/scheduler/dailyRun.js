const cron = require("node-cron");
const supabase = require("../config/supabase");
const { createRun, runPipeline } = require("../controllers/agentController");

// Track which user+minute combos have already been triggered this session
// to prevent double-firing if the cron fires slightly early on a minute boundary.
const triggered = new Set();

const startScheduler = () => {
  // Run every minute — check which users have a pipeline scheduled for this moment
  cron.schedule("* * * * *", async () => {
    try {
      const now = new Date();

      const { data: users, error } = await supabase
        .from("user_profile")
        .select("user_id, schedule_time, schedule_timezone")
        .eq("schedule_enabled", true)
        .neq("resume_text", ""); // Skip users who haven't completed their profile yet

      if (error || !users || users.length === 0) return;

      for (const user of users) {
        try {
          const timezone = user.schedule_timezone || "America/Chicago";

          // Get current HH:mm in the user's timezone
          const userTime = now.toLocaleString("en-US", {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          // schedule_time comes back as "HH:mm:ss" from Postgres TIME column
          const scheduledHHmm = String(user.schedule_time).slice(0, 5);

          // Normalize "24:xx" edge case Postgres sometimes returns for midnight
          const normalizedUserTime = userTime === "24:00" ? "00:00" : userTime;

          if (normalizedUserTime !== scheduledHHmm) continue;

          // Dedup: only fire once per user per minute
          const key = `${user.user_id}:${now.toISOString().slice(0, 16)}`;
          if (triggered.has(key)) continue;
          triggered.add(key);

          // Clean up old keys (keep last 60) to avoid memory leak
          if (triggered.size > 60) {
            const oldest = [...triggered][0];
            triggered.delete(oldest);
          }

          console.log(`[Scheduler] Running pipeline for user ${user.user_id} at ${scheduledHHmm} (${timezone})`);

          const run = await createRun("scheduler", user.user_id);
          runPipeline(run.id, user.user_id).catch((err) =>
            console.error(`[Scheduler] Pipeline error for user ${user.user_id}:`, err.message)
          );
        } catch (userErr) {
          console.error(`[Scheduler] Error processing user ${user.user_id}:`, userErr.message);
        }
      }
    } catch (err) {
      console.error("[Scheduler] Cron error:", err.message);
    }
  });

  console.log("Scheduler started — checking every minute for user-scheduled pipeline runs.");
};

module.exports = { startScheduler };
