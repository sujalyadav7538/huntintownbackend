import Conversation from "../models/conversationSchema.js";
import Message from "../models/messageSchema.js";
import User from "../models/userSchema.js";
import mongoose from "mongoose";
import cloudinary from "../utils/cloudinary.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import { NotificationManager } from "../utils/notificationManager.js";
import { ACTIONS, METRIC_TYPES } from "../config/constants.js";
import {
  inferMessageType,
  persistChatMessage,
  populateAndNormalize,
  getConversationRoomUserIds,
  emitToConversationUsers,
  getUnreadCounts,
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
          _id: String(conv.post._id),
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

      if (convTime > entry.lastMessageAt) {
        entry.lastMessageAt = convTime;
      }
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

    const unreadCounts = await getUnreadCounts(
      conversations.map((conversation) => conversation._id),
      userId,
    );

    return res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations.map((conversation) => ({
        ...conversation.toJSON(),
        unreadCount: unreadCounts.get(String(conversation._id)) ?? 0,
      })),
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
        "_id name avatar role rating location address isOnline lastSeen",
      )
      .sort({ lastMessageAt: -1, updatedAt: -1 })
      .lean();

    const conversationIds = conversations.map(
      (conversation) => conversation._id,
    );

    const unreadMap = await getUnreadCounts(conversationIds, userId);

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

    const conversation = await Conversation.findById(conversationId)
      .populate("post", "title category budget address status")
      .populate(
        "participants",
        "_id name avatar role rating location address isOnline lastSeen",
      );

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: "Conversation not found",
      });
    }

    const isParticipant = conversation.participants.some((participant) =>
      String(participant._id ?? participant) === String(userId),
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: "Unauthorized",
      });
    }

    const messages = await Message.find({ conversationId })
      .populate("sender", "_id name avatar")
      .sort({ createdAt: 1 })
      .lean();

    const normalizedMessages = messages.map((msg) => ({
      ...msg,
      conversationId: String(msg.conversationId),
      _id: String(msg._id),
      id: String(msg._id),
      sender: msg.sender
        ? {
            ...msg.sender,
            _id: String(msg.sender._id),
          }
        : null,
      text: msg.content || msg.attachment?.fileName || "",
    }));

    return res.status(200).json({
      success: true,
      count: normalizedMessages.length,
      conversation,
      data: normalizedMessages,
    });
  } catch (error) {
    next(error);
  }
};

export const getUnreadMessageCount = async (req, res, next) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    }).select("_id").lean();
    const counts = await getUnreadCounts(
      conversations.map((conversation) => conversation._id),
      req.user._id,
    );
    return res.json({
      success: true,
      unreadCount: [...counts.values()].reduce((sum, count) => sum + count, 0),
    });
  } catch (error) {
    next(error);
  }
};

export const markConversationRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user._id;
    const { messageIds } = req.body ?? {};
    if (!Array.isArray(messageIds) || messageIds.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ success: false, message: "Invalid message ids" });
    }
    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ success: false, message: "Conversation not found" });
    }
    if (!conversation.participants.some((participant) => String(participant) === String(userId))) {
      return res.status(403).json({ success: false, message: "Unauthorized" });
    }

    const unread = await Message.find({
      _id: { $in: messageIds },
      conversationId,
      sender: { $ne: userId },
      isRead: false,
    }).select("_id").lean();
    const readIds = unread.map((message) => message._id);
    if (readIds.length) {
      const readAt = new Date();
      await Message.updateMany(
        { _id: { $in: readIds }, isRead: false },
        { $set: { isRead: true, readAt }, $addToSet: { readBy: userId } },
      );
      emitToConversationUsers(req.app.get("io"), conversation, "messages-read", {
        conversationId: String(conversationId),
        readerId: String(userId),
        messageIds: readIds.map(String),
        readAt,
      });
    }
    return res.json({ success: true });
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

    const base64Data = `data:${req.file.mimetype};base64,${req.file.buffer.toString(
      "base64",
    )}`;

    const uploaded = await cloudinary.uploader.upload(base64Data, {
      folder: "huntintown/chat",
      resource_type: "auto",
      public_id: `chat_${req.user._id}_${Date.now()}`,
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

    const userId = req.user._id;

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
      senderId: userId,
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
      emitToConversationUsers(io, conversation, "new-message", normalized);
    }

    const usersInConversation = await getConversationRoomUserIds(
      io,
      conversationId,
    );
    for (const participant of conversation.participants) {
      const recipientId = String(participant);
      if (
        recipientId === String(userId) ||
        usersInConversation.has(recipientId)
      ) {
        continue;
      }

      void NotificationManager.newMessage({
        userId: participant,
        conversationId,
        postId: conversation.post,
        isHelper: recipientId === String(conversation.helper),
        sender: normalized.sender,
        message: normalized,
      }).catch(() => undefined);
    }

    updateUserMetrics(userId, [
      {
        type: METRIC_TYPES.ACTIVITY,
        action: ACTIONS.MESSAGE_SENT,
      },
      {
        type: METRIC_TYPES.RESPONSE,
        conversation,
        message: createdMessage,
      },
    ]).catch(() => undefined);

    return res.status(201).json({
      success: true,
      data: normalized,
    });
  } catch (error) {
    next(error);
  }
};
