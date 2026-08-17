import mongoose from "mongoose";
import { MODEL_NAMES, RESPONSE_STATUS } from "../config/constants.js";

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

const responseSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.POST,
      required: true,
    },

    respondedBy: {
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
      enum: Object.values(RESPONSE_STATUS),
      default: RESPONSE_STATUS.PENDING,
    },

    acceptedAt: Date,

    completedAt: Date,

    cancelledAt: Date,
  },
  {
    timestamps: true,
  },
);

// A helper can apply only once per post.
responseSchema.index({ postId: 1, respondedBy: 1 }, { unique: true });

export default mongoose.model(MODEL_NAMES.RESPONSE, responseSchema);
