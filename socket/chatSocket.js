import mongoose from "mongoose";
import Conversation from "../models/conversationSchema.js";
import {
  persistChatMessage,
  populateAndNormalize,
  getConversationRoomUserIds,
} from "../utils/chatUtils.js";
import { updateUserMetrics } from "../service/userMetricService.js";
import { ACTIONS, METRIC_TYPES } from "../config/constants.js";
import { NotificationManager } from "../utils/notificationManager.js";

export function registerChatSocket(io, socket) {
  socket.on("join-conversation", async (conversationId, callback) => {
    try {
      if (!conversationId) {
        return callback?.({
          success: false,
          message: "Conversation id is required",
        });
      }

      const userId = socket.user._id;

      const conversation = await Conversation.findById(conversationId);

      if (!conversation) {
        return callback?.({
          success: false,
          message: "Conversation not found",
        });
      }

      const isParticipant = conversation.participants.some((participant) =>
        participant.equals(userId),
      );

      if (!isParticipant) {
        return callback?.({
          success: false,
          message: "Unauthorized",
        });
      }

      socket.join(conversationId);

      callback?.({
        success: true,
        message: "Joined successfully",
      });
    } catch {
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
      const userId = socket.user._id;

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
        participant.equals(userId),
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
        {
          conversationId,
          senderId: userId,
          messageType: "text",
          content: text,
        },
        session,
      );

      await session.commitTransaction();
      session.endSession();

      const normalized = await populateAndNormalize(message._id);

      io.to(conversationId).emit("new-message", normalized);

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

      callback?.({ success: true, message: normalized });

      // Fire-and-forget — never blocks message delivery
      updateUserMetrics(userId, [
        { type: METRIC_TYPES.ACTIVITY, action: ACTIONS.MESSAGE_SENT },
        { type: METRIC_TYPES.RESPONSE, conversation, message },
      ]).catch(() => undefined);
    } catch {
      if (session.inTransaction()) await session.abortTransaction();
      session.endSession();

      callback?.({ success: false, message: "Failed to send message" });
    }
  });
}
