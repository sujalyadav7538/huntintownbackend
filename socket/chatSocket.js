import mongoose from "mongoose";
import Conversation from "../models/conversationSchema.js";
import User from "../models/userSchema.js";
import { persistChatMessage, populateAndNormalize } from "../utils/chatUtils.js";
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
      console.error("[Socket] join-conversation error:", err);
      callback?.({ success: false, message: "Internal server error" });
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

      const message = await persistChatMessage(
        { conversationId, senderId: dbUser._id, messageType: "text", content: text },
        session,
      );

      await session.commitTransaction();
      session.endSession();

      const normalized = await populateAndNormalize(message._id);

      io.to(conversationId).emit("new-message", normalized);
      callback?.({ success: true, message: normalized });

      // Fire-and-forget — never blocks message delivery
      updateUserMetrics(dbUser._id, [
        { type: METRIC_TYPES.RESPONSE, conversation, message },
      ]).catch((err) => console.error("[Metric] responseMetrics failed:", err));
    } catch (error) {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();
      console.error("[Socket] send-message error:", error);
      callback?.({ success: false, message: "Failed to send message" });
    }
  });

}
