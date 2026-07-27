import mongoose from "mongoose";
import { MODEL_NAMES, OFFER_STATUS } from "../config/constants.js";

const answerSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
    },
    answer: {
      type: String,
      required: true,
    },
  },
  { _id: false },
);

const offerSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.POST,
      required: true,
    },

    offeredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
    },

    message: {
      type: String,
      default: "",
    },

    answers: [answerSchema],

    status: {
      type: String,
      enum: Object.values(OFFER_STATUS),
      default: OFFER_STATUS.PENDING,
    },

    acceptedAt: Date,

    completedAt: Date,

    cancelledAt: Date,
  },
  {
    timestamps: true,
  },
);

export default mongoose.model(MODEL_NAMES.OFFER, offerSchema);
