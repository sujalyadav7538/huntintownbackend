import mongoose from "mongoose";
import { MODEL_NAMES } from "../config/constants.js";

// Tracks a helper reviewing the post owner (reverse direction of ratingSchema)
const helperRatingSchema = new mongoose.Schema(
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
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// One review per helper per post
helperRatingSchema.index({ postId: 1, helper: 1 }, { unique: true });

export default mongoose.model(MODEL_NAMES.HELPER_RATING, helperRatingSchema);
