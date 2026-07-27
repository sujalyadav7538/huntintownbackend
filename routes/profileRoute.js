// routes/profileRoute.js

import express from "express";
import {
  getProfile,
  updateProfile,
  getMyMetric,
  getMyBadges,
} from "../controllers/profileController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getProfile);
router.put(
  "/update",
  verifyToken,
  upload.fields([
    { name: "avatar", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
  ]),
  updateProfile,
);
router.get("/metrics", verifyToken, getMyMetric);
router.get("/badges", verifyToken, getMyBadges);

export default router;
