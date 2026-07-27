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

    text: {
      type: String,
      required: true,
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
  },
);

export default mongoose.model(MODEL_NAMES.MESSAGE, messageSchema);
