// models/Post.js

import mongoose from "mongoose";

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

    location: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: ["help_needed"],
      default: "help_needed",
    },

    budget: {
      type: String,
      default: "Negotiable",
    },

    timeline: {
      type: String,
    },

    status: {
      type: String,
      enum: ["live", "in_progress", "completed", "expired", "cancelled"],
      default: "live",
    },

    expiryDays: {
      type: Number,
      default: 10,
    },

    expiresAt: {
      type: Date,
      default: () => {
        const date = new Date();
        date.setDate(date.getDate() + 7);
        return date;
      },
    },

    questions: [
      {
        type: String,
        trim: true,
      },
    ],

    images: [
      {
        type: String, // image urls
      },
    ],

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
      ref: "User",
      required: true,
    },

    comments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Comment",
      },
    ],

    offersCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("Post", postSchema);
