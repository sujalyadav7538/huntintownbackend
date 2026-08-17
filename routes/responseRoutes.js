import express from "express";
import {
  createResponse,
  getResponsesByPost,
  acceptResponse,
  rejectResponse,
  getMyActivity,
  getResponsesForMyPosts,
  getAllResponses,
} from "../controllers/responseController.js";

import { verifyToken } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Submit a response to a post
router.post("/", verifyToken, createResponse);

// Get all responses for a post
router.get("/post/:postId", verifyToken, getAllResponses);

// Get all responses for a post (post owner only)
// router.get("/post/:postId", verifyToken, getResponsesByPost);

// Accept a response
router.patch("/:responseId/accept", verifyToken, acceptResponse);

// Reject a response
router.patch("/:responseId/reject", verifyToken, rejectResponse);

// Get current user's submitted responses (activity feed)
router.get("/my-activity", verifyToken, getMyActivity);

// Get responses received on posts authored by current user
router.get("/received", verifyToken, getResponsesForMyPosts);

export default router;
