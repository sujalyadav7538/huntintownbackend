import express from "express";
import {
  createResponse,
  startResponseConversation,
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

// The post owner can open a private conversation with an applicant.
router.post("/:responseId/conversation", verifyToken, startResponseConversation);

// Get current user's submitted responses (activity feed)
router.get("/my-activity", verifyToken, getMyActivity);

// Get responses received on posts authored by current user
router.get("/received", verifyToken, getMyPosts);

export default router;
