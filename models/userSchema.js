import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    // Public UUID
    id: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    // Authentication
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: {
      type: String,
      required: true,
      select: false,
    },

    // Profile
    name: {
      type: String,
      required: true,
      trim: true,
    },

    avatar: {
      type: String,
      default: "",
    },

    avatar_public_id: {
      type: String,
      default: "",
    },

    coverImage: {
      type: String,
      default: "",
    },

    coverImage_public_id: {
      type: String,
      default: "",
    },

    bio: {
      type: String,
      default: "",
      maxlength: 300,
    },

    role: {
      type: String,
      default: "",
    },

    // Human readable address
    address: {
      type: String,
      default: "",
    },

    // GeoJSON Location
    location: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
        required: false,
      },

      coordinates: {
        type: [Number], // [longitude, latitude]
        default: undefined,
      },
    },

    phone: {
      type: String,
      default: "",
    },

    website: {
      type: String,
      default: "",
    },

    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    // Trust
    rating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },

    totalReviews: {
      type: Number,
      default: 0,
    },

    completedJobs: {
      type: Number,
      default: 0,
    },

    reputation: {
      type: Number,
      default: 0,
    },

    // Verification
    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    isGovernmentVerified: {
      type: Boolean,
      default: false,
    },

    governmentVerificationStatus: {
      type: String,
      enum: ["none", "pending", "verified", "rejected"],
      default: "none",
    },

    // Account
    isActive: {
      type: Boolean,
      default: true,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    // Social
    followers: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
      },
    ],

    // Counters (avoid aggregation every request)
    postsCount: {
      type: Number,
      default: 0,
    },

    offersSubmittedCount: {
      type: Number,
      default: 0,
    },

    offersAcceptedCount: {
      type: Number,
      default: 0,
    },

    conversationsCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model("User", userSchema);
