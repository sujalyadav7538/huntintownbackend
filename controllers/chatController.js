import Conversation from "../models/conversationSchema.js";
import Message from "../models/messageSchema.js";
import User from "../models/userSchema.js";
import mongoose from "mongoose";
import cloudinary from "../utils/cloudinary.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import { METRIC_TYPES } from "../config/constants.js";
import {
  inferMessageType,
  persistChatMessage,
  populateAndNormalize,
} from "../utils/chatUtils.js";

/**
 * POST /api/chat/posts
 * Returns the unique posts that have conversations for the current user,
 * aggregated with conversationCount and latest activity time.
 */
export const getPostsWithConversations = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ hunter: userId })
      .populate("post", "title category budget address status")
      .sort({ updatedAt: -1 })
      .lean();

    // Group by post, accumulate stats
    const postMap = new Map();
    for (const conv of conversations) {
      if (!conv.post) continue;
      const postId = conv.post._id.toString();
      if (!postMap.has(postId)) {
        postMap.set(postId, {
          _id: conv.post._id,
          title: conv.post.title,
          category: conv.post.category,
          budget: conv.post.budget,
          location: conv.post.address,
          status: conv.post.status,
          conversationCount: 0,
          lastMessageAt: conv.lastMessageAt || conv.updatedAt,
        });
      }
      const entry = postMap.get(postId);
      entry.conversationCount++;
      const convTime = conv.lastMessageAt || conv.updatedAt;
      if (convTime > entry.lastMessageAt) entry.lastMessageAt = convTime;
    }

    return res.status(200).json({
      success: true,
      data: Array.from(postMap.values()),
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/posts/:postId/conversations
 * Returns all conversations the current user has for a specific post.
 */
export const getConversationsByPost = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const { postId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(postId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid post id",
      });
    }

    const conversations = await Conversation.find({
      hunter: userId,
      post: postId,
    })
      .populate("post", "title category budget address status")
      .populate(
        "participants",
        "_id name avatar role rating location address isOnline lastSeen",
      )
      .sort({ updatedAt: -1 });

    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/my-chats
 * Returns conversations where current user is the helper/participant,
 * with post summary, other participant, and unread count.
 */
export const getMyChats = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const conversations = await Conversation.find({ helper: userId })
      .populate("post", "title category budget address status")
      .populate(
        "participants",
        "id name avatar role rating location address isOnline lastSeen",
      )
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const conversationIds = conversations.map(
      (conversation) => conversation._id,
    );
    const unreadMap = new Map();

    if (conversationIds.length) {
      const unreadCounts = await Message.aggregate([
        {
          $match: {
            conversationId: { $in: conversationIds },
            sender: { $ne: new mongoose.Types.ObjectId(userId) },
            isRead: false,
          },
        },
        {
          $group: {
            _id: "$conversationId",
            count: { $sum: 1 },
          },
        },
      ]);

      unreadCounts.forEach((entry) => {
        unreadMap.set(String(entry._id), entry.count);
      });
    }

    const uniqueByPost = new Map();

    conversations.forEach((conversation) => {
      const key = conversation.post?._id
        ? String(conversation.post._id)
        : String(conversation._id);

      // Conversations are already sorted by latest activity, so keep first one.
      if (!uniqueByPost.has(key)) {
        uniqueByPost.set(key, conversation);
      }
    });

    const data = Array.from(uniqueByPost.values()).map((conversation) => {
      const otherUser =
        conversation.participants.find(
          (participant) => String(participant._id) !== String(userId),
        ) ??
        conversation.participants[0] ??
        null;

      return {
        ...conversation,
        postId: conversation.post?._id ?? null,
        otherUser,
        unreadCount: unreadMap.get(String(conversation._id)) ?? 0,
      };
    });

    return res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

export const getConversationMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    await Message.updateMany(
      {
        conversationId,
        sender: { $ne: userId },
        isRead: false,
      },
      {
        isRead: true,
        $addToSet: {
          readBy: userId,
        },
      },
    );
    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((participant) =>
      participant.equals(userId),
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "id name avatar")
      .sort({ createdAt: 1 })
      .lean();

    const normalizedMessages = messages.map((msg) => ({
      ...msg,
      conversationId: String(msg.conversationId),
      _id: String(msg._id),
      text: msg.content || msg.attachment?.fileName || "",
    }));

    return res.status(200).json({
      success: true,
      count: normalizedMessages.length,
      data: normalizedMessages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/upload
 * Uploads a single file to Cloudinary and returns attachment metadata.
 */
export const uploadAttachment = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Attachment file is required",
      });
    }

    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    const uploaded = await cloudinary.uploader.upload(base64Data, {
      folder: "huntintown/chat",
      resource_type: "auto",
      public_id: `chat_${req.user.id}_${Date.now()}`,
      use_filename: true,
      unique_filename: true,
      overwrite: false,
    });

    const messageType = inferMessageType(req.file.mimetype);

    return res.status(200).json({
      success: true,
      data: {
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
        thumbnail: uploaded.secure_url,
        messageType,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/chat/messages
 * Persists a chat message (text or attachment metadata) and broadcasts it.
 */
export const createMessage = async (req, res, next) => {
  try {
    const {
      conversationId,
      content = "",
      messageType = "text",
      attachment,
    } = req.body;

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: "Conversation id is required",
      });
    }

    const dbUser = await User.findOne({ id: req.user.id }).select("_id");
    if (!dbUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((participant) =>
      participant.equals(dbUser._id),
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (messageType === "text" && !content.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message cannot be empty",
      });
    }

    if (messageType !== "text" && !attachment?.url) {
      return res.status(400).json({
        success: false,
        message: "Attachment metadata is required for file messages",
      });
    }

    const createdMessage = await persistChatMessage({
      conversationId,
      senderId: dbUser._id,
      messageType,
      content,
      attachment: attachment
        ? {
            url: attachment.url || "",
            publicId: attachment.publicId || "",
            fileName: attachment.fileName || "",
            mimeType: attachment.mimeType || "",
            size: attachment.size || 0,
            thumbnail: attachment.thumbnail || "",
          }
        : undefined,
    });

    const normalized = await populateAndNormalize(createdMessage._id);

    const io = req.app.get("io");
    if (io) {
      io.to(conversationId).emit("new-message", normalized);
    }

    updateUserMetrics(dbUser._id, [
      { type: METRIC_TYPES.RESPONSE, conversation, message: createdMessage },
    ]).catch((err) => console.error("[Metric] responseMetrics failed:", err));

    return res.status(201).json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    next(error);
  }
};
