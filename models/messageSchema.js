import mongoose from "mongoose";
import { MODEL_NAMES } from "../config/constants.js";

const messageSchema = new mongoose.Schema(
  {
    conversationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.CONVERSATION,
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
    },

    messageType: {
      type: String,
      enum: ["text", "image", "video", "audio", "document"],
      default: "text",
    },

    content: {
      type: String,
      default: "",
      trim: true,
    },

    attachment: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
      fileName: { type: String, default: "" },
      mimeType: { type: String, default: "" },
      size: { type: Number, default: 0 },
      thumbnail: { type: String, default: "" },
    },

    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },

    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: MODEL_NAMES.USER }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Backward compatibility for existing frontend usage (msg.text)
messageSchema
  .virtual("text")
  .get(function getText() {
    return this.content;
  })
  .set(function setText(value) {
    this.content = value;
  });

export default mongoose.model(MODEL_NAMES.MESSAGE, messageSchema);
