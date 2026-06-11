const supabase = require("../config/supabase");

const isDev = process.env.NODE_ENV !== "production";

// GET /api/profile
const getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    let { data, error } = await supabase
      .from("user_profile")
      .select("*")
      .eq("user_id", userId)
      .single();

    // Auto-create profile row if it doesn't exist (e.g. signed up before trigger was added)
    if (error?.code === "PGRST116" || !data) {
      const { data: created, error: createError } = await supabase
        .from("user_profile")
        .insert({ user_id: userId, full_name: req.user.user_metadata?.full_name ?? "" })
        .select()
        .single();

      if (createError) throw new Error(createError.message);
      data = created;
    } else if (error) {
      throw new Error(error.message);
    }

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to fetch profile.", ...(isDev && { details: err.message }) });
  }
};

// PATCH /api/profile
// Allows partial updates: resume_text, target_roles, target_locations,
// min_score, full_name, schedule_time, schedule_timezone, schedule_enabled, onboarded
const updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const ALLOWED_FIELDS = [
      "full_name",
      "resume_text",
      "target_roles",
      "target_locations",
      "min_score",
      "schedule_time",
      "schedule_timezone",
      "schedule_enabled",
      "onboarded",
    ];

    const patch = {};
    for (const field of ALLOWED_FIELDS) {
      if (req.body[field] !== undefined) {
        patch[field] = req.body[field];
      }
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ success: false, error: "No valid fields to update." });
    }

    // Validate resume_text length (max 20,000 chars ~ 5,000 tokens)
    if (patch.resume_text !== undefined && patch.resume_text.length > 20000) {
      return res.status(400).json({ success: false, error: "Resume text must be under 20,000 characters. Please trim your resume." });
    }

    // Validate min_score range
    if (patch.min_score !== undefined) {
      const score = parseInt(patch.min_score, 10);
      if (isNaN(score) || score < 0 || score > 100) {
        return res.status(400).json({ success: false, error: "min_score must be between 0 and 100." });
      }
      patch.min_score = score;
    }

    // Validate schedule_time format HH:mm
    if (patch.schedule_time !== undefined) {
      if (!/^\d{2}:\d{2}$/.test(patch.schedule_time)) {
        return res.status(400).json({ success: false, error: "schedule_time must be in HH:mm format." });
      }
    }

    const { data, error } = await supabase
      .from("user_profile")
      .update(patch)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to update profile.", ...(isDev && { details: err.message }) });
  }
};

module.exports = { getProfile, updateProfile };
