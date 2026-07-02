import Conversation from "../models/conversationSchema.js";
import Message from "../models/messageSchema.js";
import User from "../models/userSchema.js";

export default function registerChatSocket(io, socket) {
  socket.on("join-conversation", async (conversationId, callback) => {
    try {
      if (!conversationId) {
        return callback?.({
          success: false,
          message: "Conversation id is required",
        });
      }

      // Find logged in user using UUID from JWT
      const dbUser = await User.findOne({ id: socket.user.id }).select("_id");

      if (!dbUser) {
        return callback?.({
          success: false,
          message: "User not found",
        });
      }

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return callback?.({
          success: false,
          message: "Conversation not found",
        });
      }

      const isParticipant = conversation.participants.some((participant) =>
        participant.equals(dbUser._id),
      );

      if (!isParticipant) {
        return callback?.({
          success: false,
          message: "Unauthorized",
        });
      }

      socket.join(conversationId);

      console.log(
        `[Socket] ${socket.user.id} joined conversation ${conversationId}`,
      );

      callback?.({
        success: true,
        message: "Joined successfully",
      });
    } catch (err) {
      console.error(err);

      callback?.({
        success: false,
        message: "Internal server error",
      });
    }
  });

  socket.on("send-message", async (payload, callback) => {
    try {
      const { conversationId, text } = payload;

      if (!conversationId) {
        return callback?.({
          success: false,
          message: "Conversation id is required",
        });
      }

      if (!text || !text.trim()) {
        return callback?.({
          success: false,
          message: "Message cannot be empty",
        });
      }

      // Logged in user
      const dbUser = await User.findOne({ id: socket.user.id });

      if (!dbUser) {
        return callback?.({
          success: false,
          message: "User not found",
        });
      }

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return callback?.({
          success: false,
          message: "Conversation not found",
        });
      }

      const isParticipant = conversation.participants.some((participant) =>
        participant.equals(dbUser._id),
      );

      if (!isParticipant) {
        return callback?.({
          success: false,
          message: "Unauthorized",
        });
      }

      // Create message
      const message = await Message.create({
        conversationId,
        sender: dbUser._id,
        text: text.trim(),
        readBy: [dbUser._id],
        isRead: false,
      });

      // Update conversation
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = new Date();

      await conversation.save();

      // Populate sender for frontend
      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "id name avatar")
        .lean();

      console.log(
        `[Socket] Message sent in conversation ${conversationId} by ${dbUser.name}`,
      );

      io.to(conversationId).emit("new-message", populatedMessage);

      callback?.({
        success: true,
        message: populatedMessage,
      });
    } catch (error) {
      console.error(error);

      callback?.({
        success: false,
        message: "Failed to send message",
      });
    }
  });

  socket.on("mark-read", async ({ conversationId }, callback) => {
    try {
      const dbUser = await User.findOne({ id: socket.user.id }).select("_id");

      if (!dbUser) {
        return callback?.({
          success: false,
          message: "User not found",
        });
      }

      await Message.updateMany(
        {
          conversationId,
          sender: { $ne: dbUser._id },
          readBy: { $ne: dbUser._id },
        },
        {
          $push: {
            readBy: dbUser._id,
          },
          $set: {
            isRead: true,
            readAt: new Date(),
          },
        },
      );

      io.to(conversationId).emit("messages-read", {
        conversationId,
        userId: socket.user.id,
      });

      callback?.({
        success: true,
      });
    } catch (err) {
      console.error(err);

      callback?.({
        success: false,
        message: "Failed to mark messages as read",
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Socket] ${socket.user.id} disconnected`);
  });
}
