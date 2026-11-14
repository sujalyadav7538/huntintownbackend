import express from "express";
import { optionalAuth } from "../middlewares/authMiddleware.js";
import { trackEvent } from "../controllers/metaController.js";

const router = express.Router();

router.post("/event", optionalAuth, trackEvent);

export default router;
