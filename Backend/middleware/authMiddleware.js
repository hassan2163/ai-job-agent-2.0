const supabase = require("../config/supabase");

/**
 * Verifies the Supabase JWT from the Authorization header.
 * Attaches req.user = { id, email, ... } on success.
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, error: "Missing or invalid Authorization header." });
  }

  const token = authHeader.split(" ")[1];

  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return res.status(401).json({ success: false, error: "Invalid or expired token." });
  }

  req.user = user;
  next();
};

module.exports = authMiddleware;
