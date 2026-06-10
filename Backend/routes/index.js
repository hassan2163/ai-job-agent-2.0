const express = require("express");

const agentRoutes = require("./agentRoutes");
const dashboardRoutes = require("./dashboardRoutes");
const profileRoutes = require("./profileRoutes");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.use("/agent", authMiddleware, agentRoutes);
router.use("/dashboard", authMiddleware, dashboardRoutes);
router.use("/profile", profileRoutes); // auth applied inside profileRoutes

module.exports = router;
