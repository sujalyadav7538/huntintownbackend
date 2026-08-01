import Message from "../models/messageSchema.js";
import Conversation from "../models/conversationSchema.js";

/**
 * Derive the messageType from a MIME type string.
 */
export function inferMessageType(mimeType = "") {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("video/")) return "video";
  if (mimeType.startsWith("audio/")) return "audio";
  return "document";
}

/**
 * Persist a message + update conversation.lastMessage.
 * Pass an already-started Mongoose session when the caller manages the transaction.
 */
export async function persistChatMessage(
  { conversationId, senderId, messageType = "text", content = "", attachment },
  session = null,
) {
  const [message] = await Message.create(
    [
      {
        conversationId,
        sender: senderId,
        messageType,
        content: typeof content === "string" ? content.trim() : "",
        attachment: attachment ?? undefined,
        readBy: [senderId],
        isRead: false,
      },
    ],
    session ? { session } : {},
  );

  await Conversation.findByIdAndUpdate(
    conversationId,
    { lastMessage: message._id, lastMessageAt: message.createdAt },
    session ? { session } : {},
  );

  return message;
}

/**
 * Populate sender on a message and normalize for socket/HTTP emission.
 * lean() bypasses Mongoose virtuals, so we set text = content explicitly.
 * conversationId is coerced to a plain string so frontend key lookups match.
 */
export async function populateAndNormalize(messageId) {
  const msg = await Message.findById(messageId)
    .populate("sender", "id name avatar")
    .lean();

  if (!msg) return null;

  return {
    ...msg,
    conversationId: String(msg.conversationId),
    _id: String(msg._id),
    text: msg.content || msg.attachment?.fileName || "",
  };
}
