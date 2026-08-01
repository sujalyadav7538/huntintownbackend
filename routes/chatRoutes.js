import express from "express";

import { verifyToken } from "../middlewares/authMiddleware.js";
import {
  getConversationMessages,
  getPostsWithConversations,
  getConversationsByPost,
  uploadAttachment,
  createMessage,
} from "../controllers/chatController.js";
import { uploadChatAttachment } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// Post-first routes — declared before /:conversationId to avoid param conflicts
router.get("/posts", verifyToken, getPostsWithConversations);
router.get("/posts/:postId/conversations", verifyToken, getConversationsByPost);
router.get("/:conversationId/messages", verifyToken, getConversationMessages);

router.post("/upload", verifyToken, uploadChatAttachment.single("file"), uploadAttachment);
router.post("/messages", verifyToken, createMessage);

export default router;
