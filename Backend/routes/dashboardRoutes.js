const { Router } = require("express");
const {
  getStats,
  listApplications,
  getApplication,
  updateApplication,
  downloadDocument,
} = require("../controllers/dashboardController");

const router = Router();

router.get("/stats", getStats);
router.get("/applications", listApplications);
router.get("/applications/:id/download", downloadDocument);
router.get("/applications/:id", getApplication);
router.patch("/applications/:id", updateApplication);

module.exports = router;
