const express = require("express");
const { triggerRun, getRunStatus, listRuns } = require("../controllers/agentController");

const router = express.Router();

router.post("/run", triggerRun);
router.get("/runs", listRuns);
router.get("/status/:runId", getRunStatus);

module.exports = router;
