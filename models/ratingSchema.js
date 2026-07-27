import mongoose from "mongoose";
import { MODEL_NAMES } from "../config/constants.js";

const ratingSchema = new mongoose.Schema(
  {
    postId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.POST,
      required: true,
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    comment: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  },
);

ratingSchema.index(
  { postId: 1, hunter: 1, helper: 1 },
  { unique: true },
);
export default mongoose.model(MODEL_NAMES.RATING, ratingSchema);
