import mongoose from "mongoose";
import { MODEL_NAMES, BADGE_LEVELS } from "../config/constants.js";

const badgeSchema = new mongoose.Schema(
  {
    badgeId: {
      type: String,
      required: true,
    },

    level: {
      type: String,
      default: BADGE_LEVELS.BRONZE,
    },

    earnedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    _id: false,
  },
);

const userBadgeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      unique: true,
      required: true,
    },

    badges: {
      type: [badgeSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model(MODEL_NAMES.USER_BADGE, userBadgeSchema);
