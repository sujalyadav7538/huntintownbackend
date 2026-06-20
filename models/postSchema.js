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
      enum: ["Live", "fulfilled", "expired"],
      default: "Live",
      index: true, // Add an index for faster queries on status
    },

    expiryDays: {
      type: Number,
      default: 10,
    },

    expiresAt: {
      type: Date,
      required: true,
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
      id: {
        type: String,
        required: true,
      },
      name: String,
      email: String,
      avatar: String,
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
