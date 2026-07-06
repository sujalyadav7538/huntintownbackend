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

    // Human readable address
    address: {
      type: String,
      required: true,
    },

    // GeoJSON Location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number], // [longitude, latitude]
        required: true,
      },
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

    timeline: String,

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

// VERY IMPORTANT
postSchema.index({
  location: "2dsphere",
});

export default mongoose.model("Post", postSchema);
