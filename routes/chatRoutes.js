import express from "express";

import { verifyToken } from "../middlewares/authMiddleware.js";
import {
  getConversationMessages,
  getMyConversations,
  markMessagesAsRead,
  sendMessage,
} from "../controllers/chatController.js";

const router = express.Router();

router.get("/conversations", verifyToken, getMyConversations);

router.get("/:conversationId/messages", verifyToken, getConversationMessages);

router.post("/:conversationId/message", verifyToken, sendMessage);

router.patch("/:conversationId/read", verifyToken, markMessagesAsRead);

export default router;
