import mongoose from "mongoose";
import { MODEL_NAMES, GEO_TYPE, VERIFICATION_STATUS } from "../config/constants.js";

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

    // Basic Profile
    name: {
      type: String,
      required: true,
      trim: true,
    },

    bio: {
      type: String,
      default: "",
      maxlength: 700,
    },

    role: {
      type: String,
      default: "",
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

    // Contact
    phone: {
      type: String,
      default: "",
    },

    website: {
      type: String,
      default: "",
    },

    // Skills
    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    // Address
    address: {
      type: String,
      default: "",
    },

    location: {
      type: {
        type: String,
        enum: [GEO_TYPE.POINT],
        default: GEO_TYPE.POINT,
      },

      coordinates: {
        type: [Number],
        default: undefined,
      },
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
      enum: Object.values(VERIFICATION_STATUS),
      default: VERIFICATION_STATUS.NONE,
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
        ref: MODEL_NAMES.USER,
      },
    ],

    following: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: MODEL_NAMES.USER,
      },
    ],

    // Statistics
    postsCount: {
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

userSchema.index({
  location: "2dsphere",
});

export default mongoose.model(MODEL_NAMES.USER, userSchema);
