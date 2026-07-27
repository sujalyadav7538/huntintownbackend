import mongoose from "mongoose";
import { MODEL_NAMES, POST_STATUS, POST_TYPE, GEO_TYPE } from "../config/constants.js";

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
      maxlength: 300,
    },

    category: {
      type: String,
      required: true,
    },

    // Human readable address
    address: {
      type: String,
      required: true,
    },

    // GeoJSON Location
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

    type: {
      type: String,
      enum: Object.values(POST_TYPE),
      default: POST_TYPE.HELP_NEEDED,
    },

    budget: {
      type: String,
      default: "Negotiable",
    },

    timeline: String,

    status: {
      type: String,
      enum: Object.values(POST_STATUS),
      default: POST_STATUS.LIVE,
    },

    expiryDays: {
      type: Number,
      default: 10,
    },

    expiresAt: {
      type: Date,
      default: () => {
        const d = new Date();
        d.setDate(d.getDate() + 7);
        return d;
      },
    },

    questions: [
      {
        type: String,
        trim: true,
      },
    ],

    images: [String],

    contactMethods: {
      whatsApp: {
        type: Boolean,
        default: true,
      },

      phone: {
        type: Boolean,
        default: true,
      },

      chat: {
        type: Boolean,
        default: true,
      },
    },

    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
    },

    applicants:{
      type: [mongoose.Schema.Types.ObjectId],
      ref: MODEL_NAMES.USER,
      default: [],
    },

    offersCount: {
      type: Number,
      default: 0,
    },
    
  },
  {
    timestamps: true,
  },
);

// VERY IMPORTANT
postSchema.index({
  location: "2dsphere",
});

export default mongoose.model(MODEL_NAMES.POST, postSchema);
