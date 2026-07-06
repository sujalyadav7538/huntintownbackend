import express from "express";

import { verifyToken } from "../middlewares/authMiddleware.js";
import {
  getConversationMessages,
  getMyConversations,
  getPostsWithConversations,
  getConversationsByPost,
  markMessagesAsRead,
  sendMessage,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/conversations", verifyToken, getMyConversations);

// Post-first routes — must be declared BEFORE /:conversationId to avoid param conflicts
router.get("/posts", verifyToken, getPostsWithConversations);
router.get("/posts/:postId/conversations", verifyToken, getConversationsByPost);

router.get("/:conversationId/messages", verifyToken, getConversationMessages);

router.post("/:conversationId/message", verifyToken, sendMessage);

router.patch("/:conversationId/read", verifyToken, markMessagesAsRead);

export default router;
