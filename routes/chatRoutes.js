import express from "express";

import { verifyToken } from "../middlewares/authMiddleware.js";
import {
  getConversationMessages,
  getPostsWithConversations,
  getConversationsByPost,
  // DEAD: getMyConversations — fetchConversations thunk in thunks.ts is never dispatched anywhere
  // getMyConversations,
  // DEAD: sendMessage (HTTP) — frontend sends messages via socket "send-message" event, not REST
  // sendMessage,
  // DEAD: markMessagesAsRead — frontend never calls this HTTP endpoint; socket "mark-read" also unused
  // markMessagesAsRead,
} from "../controllers/chatController.js";

const router = express.Router();

// DEAD: GET /conversations — fetchConversations thunk exists in thunks.ts but is never dispatched
// router.get("/conversations", verifyToken, getMyConversations);

// Post-first routes — must be declared BEFORE /:conversationId to avoid param conflicts
router.get("/posts", verifyToken, getPostsWithConversations);
router.get("/posts/:postId/conversations", verifyToken, getConversationsByPost);

router.get("/:conversationId/messages", verifyToken, getConversationMessages);

// DEAD: POST /:conversationId/message — frontend sends messages via socket "send-message", not HTTP
// router.post("/:conversationId/message", verifyToken, sendMessage);

// DEAD: PATCH /:conversationId/read — frontend never calls this; socket "mark-read" also unused
// router.patch("/:conversationId/read", verifyToken, markMessagesAsRead);

export default router;
