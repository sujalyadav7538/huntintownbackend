import Conversation from "../models/conversationSchema.js";
import Message from "../models/messageSchema.js";
import User from "../models/userSchema.js";
import mongoose from "mongoose";
import { updateUserMetrics } from "../controllers/userMetricController.js";
import { METRIC_TYPES } from "../config/constants.js";

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
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const { conversationId, text } = payload;

      if (!conversationId) {
        await session.abortTransaction();
        session.endSession();

        return callback?.({
          success: false,
          message: "Conversation id is required",
        });
      }

      if (!text?.trim()) {
        await session.abortTransaction();
        session.endSession();

        return callback?.({
          success: false,
          message: "Message cannot be empty",
        });
      }

      // Logged in user
      const dbUser = await User.findOne({ id: socket.user.id }).session(
        session,
      );

      if (!dbUser) {
        await session.abortTransaction();
        session.endSession();

        return callback?.({
          success: false,
          message: "User not found",
        });
      }

      // Conversation
      const conversation =
        await Conversation.findById(conversationId).session(session);

      if (!conversation) {
        await session.abortTransaction();
        session.endSession();

        return callback?.({
          success: false,
          message: "Conversation not found",
        });
      }

      // Authorization
      const isParticipant = conversation.participants.some((participant) =>
        participant.equals(dbUser._id),
      );

      if (!isParticipant) {
        await session.abortTransaction();
        session.endSession();

        return callback?.({
          success: false,
          message: "Unauthorized",
        });
      }

      // Create Message
      const [message] = await Message.create(
        [
          {
            conversationId,
            sender: dbUser._id,
            text: text.trim(),
            readBy: [dbUser._id],
            isRead: false,
          },
        ],
        { session },
      );

      // Update Conversation
      conversation.lastMessage = message._id;
      conversation.lastMessageAt = message.createdAt;

      await conversation.save({ session });

      // Commit transaction
      await session.commitTransaction();
      session.endSession();

      // Populate sender for frontend
      const populatedMessage = await Message.findById(message._id)
        .populate("sender", "id name avatar")
        .lean();

      // Emit to all participants
      io.to(conversationId).emit("new-message", populatedMessage);

      callback?.({
        success: true,
        message: populatedMessage,
      });

      // Fire-and-forget after commit — never blocks message delivery.
      // Passes the already-loaded conversation + message; no extra DB fetch.
      updateUserMetrics(dbUser._id, [
        { type: METRIC_TYPES.RESPONSE, conversation, message },
      ]).catch((err) => console.error("[Metric] responseMetrics failed:", err));

    } catch (error) {
      // Guard: only abort if the transaction hasn't been committed yet
      if (session.inTransaction()) {
        await session.abortTransaction();
      }
      session.endSession();

      console.error(error);

      callback?.({
        success: false,
        message: "Failed to send message",
      });
    }
  });

  // DEAD: "mark-read" socket event — never emitted from the frontend.
  // The HTTP PATCH /:conversationId/read route (markMessagesAsRead) is also unused.
  // The "messages-read" broadcast below is therefore also unreachable from the client.
  // socket.on("mark-read", async ({ conversationId }, callback) => {
  //   try {
  //     const dbUser = await User.findOne({ id: socket.user.id }).select("_id");
  //
  //     if (!dbUser) {
  //       return callback?.({
  //         success: false,
  //         message: "User not found",
  //       });
  //     }
  //
  //     await Message.updateMany(
  //       {
  //         conversationId,
  //         sender: { $ne: dbUser._id },
  //         readBy: { $ne: dbUser._id },
  //       },
  //       {
  //         $push: {
  //           readBy: dbUser._id,
  //         },
  //         $set: {
  //           isRead: true,
  //           readAt: new Date(),
  //         },
  //       },
  //     );
  //
  //     io.to(conversationId).emit("messages-read", {
  //       conversationId,
  //       userId: socket.user.id,
  //     });
  //
  //     callback?.({
  //       success: true,
  //     });
  //   } catch (err) {
  //     console.error(err);
  //
  //     callback?.({
  //       success: false,
  //       message: "Failed to mark messages as read",
  //     });
  //   }
  // });

  socket.on("disconnect", () => {
    console.log(`[Socket] ${socket.user.id} disconnected`);
  });
}
