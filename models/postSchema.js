import mongoose from "mongoose";
import {
  MODEL_NAMES,
  POST_STATUS,
  POST_TYPE,
  GEO_TYPE,
} from "../config/constants.js";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300,
    },

    // What the post is about
    category: {
      type: String,
      required: true,
    },

    // "help_needed" → user needs someone
    // "offer_help"  → user can help someone
    type: {
      type: String,
      enum: Object.values(POST_TYPE),
      default: POST_TYPE.HELP_NEEDED,
      required: true,
    },

    // Human-readable location
    address: {
      type: String,
      required: true,
      trim: true,
    },

    // GeoJSON
    location: {
      type: {
        type: String,
        enum: [GEO_TYPE.POINT],
        default: GEO_TYPE.POINT,
      },

      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
    },

    budget: {
      type: String,
      default: "Negotiable",
      trim: true,
    },

    timeline: {
      type: String,
      default: "Flexible",
      trim: true,
    },

    images: {
      type: [String],
      default: [],
    },

    // Questions shown to people responding to this post
    questions: [
      {
        type: String,
        trim: true,
      },
    ],

    status: {
      type: String,
      enum: Object.values(POST_STATUS),
      default: POST_STATUS.LIVE,
    },

    expiryDays: {
      type: Number,
      default: 7,
      min: 1,
      max: 30,
    },

    expiresAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d;
      },
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
    },

    // People who have responded to this post
    respondents: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: MODEL_NAMES.USER,
      },
    ],

    responsesCount: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model(MODEL_NAMES.POST, postSchema);
