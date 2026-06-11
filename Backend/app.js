require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const routes = require("./routes");
const { startScheduler } = require("./scheduler/dailyRun");

const app = express();
const isDevelopment = process.env.NODE_ENV !== "production";

const allowedOrigins = (process.env.FRONTEND_URL || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(helmet());

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (e.g. curl, Postman)
    if (!origin) return callback(null, true);
    // In development, allow any localhost origin regardless of port
    if (isDevelopment && /^https?:\/\/localhost(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  methods: ["POST", "GET", "PATCH"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

app.use(express.json({ limit: "250kb" }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.RATE_LIMIT_MAX ? parseInt(process.env.RATE_LIMIT_MAX) : (isDevelopment ? 500 : 100),
  message: {
    success: false,
    error: "Too many requests. Please try again later."
  }
});

app.use("/api", limiter);
app.use("/api", routes);

app.get("/health", async (req, res) => {
  try {
    const supabase = require("./config/supabase");
    const { error } = await supabase.from("user_profile").select("user_id").limit(1);
    if (error) throw new Error(error.message);
    res.json({ success: true, status: "ok", db: "connected" });
  } catch (err) {
    res.status(503).json({ success: false, status: "degraded", db: "unreachable", error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error("Request error:", err.message);

  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      error: "Resume file is too large. Please upload a .txt file under 2 MB.",
    });
  }

  return res.status(400).json({
    success: false,
    error: err.message || "Invalid request. Please check your inputs.",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Job Agent running on port ${PORT}`);
  startScheduler();
});
