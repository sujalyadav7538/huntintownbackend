import express from "express";
import {
  createResponse,
  acceptResponse,
  rejectResponse,
  reconsiderResponse,
  getMyActivity,
  getMyPosts,
  getAllResponses,
} from "../controllers/responseController.js";

import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Submit a response to a post
router.post("/", verifyToken, createResponse);

// Public response list; submitting and managing responses remains authenticated.
router.get("/post/:postId", getAllResponses);

// Accept a response
router.patch("/:responseId/accept", verifyToken, acceptResponse);

// Reject a response
router.patch("/:responseId/reject", verifyToken, rejectResponse);

// Reopen a rejected response for consideration by its post owner
router.patch("/:responseId/reconsider", verifyToken, reconsiderResponse);

// Get current user's submitted responses (activity feed)
router.get("/my-activity", verifyToken, getMyActivity);

// Get responses received on posts authored by current user
router.get("/received", verifyToken, getMyPosts);

export default router;
