// routes/profileRoute.js

import express from "express";
import {
  getUserProfile,
  updateProfile,
  getMyMetric,
  getMyBadges,
  getPublicProfile,
  getProfilePosts,
} from "../controllers/profileController.js";
import { verifyToken } from "../middlewares/authMiddleware.js";
import upload from "../middlewares/uploadMiddleware.js";

const router = express.Router();

router.get("/", verifyToken, getUserProfile);
router.get("/posts", verifyToken, getProfilePosts);
router.get("/:id/posts", verifyToken, getProfilePosts);
router.get("/metrics", verifyToken, getMyMetric);
router.get("/badges", verifyToken, getMyBadges);
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

export default router;
