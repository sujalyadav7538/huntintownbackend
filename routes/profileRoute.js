// routes/profileRoute.js

import express from "express";
import {
  getUserProfile,
  updateProfile,
  getMyMetric,
  getMyBadges,
  getPublicProfile
} from "../controllers/profileController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getUserProfile);
router.get("/:id", verifyToken, getPublicProfile);
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
