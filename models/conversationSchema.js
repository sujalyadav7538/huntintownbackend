import mongoose from "mongoose";
import { MODEL_NAMES, CONVERSATION_STATUS } from "../config/constants.js";

const conversationSchema = new mongoose.Schema(
  {
    post: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.POST,
      required: true,
    },

    offerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.OFFER,
      required: true,
      unique: true,
    },

    hunter: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
    },

    helper: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
    },

    participants: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: MODEL_NAMES.USER,
        required: true,
      },
    ],
    responseTracking: {
      acceptedAt: {
        type: Date,
        required: true,
      },

      firstMessageAt: Date,

      hunterCompleted: {
        type: Boolean,
        default: false,
      },

      helperCompleted: {
        type: Boolean,
        default: false,
      },
    },

    status: {
      type: String,
      enum: Object.values(CONVERSATION_STATUS),
      default: CONVERSATION_STATUS.ACTIVE,
    },

    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.MESSAGE,
    },

    lastMessageAt: Date,
  },
  {
    timestamps: true,
  },
);

export default mongoose.model(MODEL_NAMES.CONVERSATION, conversationSchema);
