import mongoose from "mongoose";
import {
  MODEL_NAMES,
  GEO_TYPE,
  VERIFICATION_STATUS,
} from "../config/constants.js";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PHONE_REGEX = /^\+?[1-9]\d{7,14}$/;

const userSchema = new mongoose.Schema(
  {
    // --------------------------------------------------
    // Identity
    // --------------------------------------------------

    id: {
      type: String,
      required: [true, "User ID is required"],
      unique: true,
      immutable: true,
      index: true,
      trim: true,
    },

    // --------------------------------------------------
    // Authentication
    // --------------------------------------------------

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
      validate: {
        validator(value) {
          return EMAIL_REGEX.test(value);
        },
        message: "Please provide a valid email address",
      },
    },

    // Always store a HASH here, never plaintext password.
    passwordHash: {
      type: String,
      select: false,
      required: function () {
        // Password is required only for local-auth users.
        return !this.googleId;
      },
    },

    googleId: {
      type: String,
      trim: true,
      select: false,
    },

    // --------------------------------------------------
    // Profile
    // --------------------------------------------------

    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },

    bio: {
      type: String,
      default: "",
      trim: true,
      maxlength: [700, "Bio cannot exceed 700 characters"],
    },

    role: {
      type: String,
      default: "",
      trim: true,
      maxlength: [100, "Role cannot exceed 100 characters"],
    },

    avatar: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2048,
    },

    avatar_public_id: {
      type: String,
      default: "",
      trim: true,
      maxlength: 255,
    },

    coverImage: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2048,
    },

    coverImage_public_id: {
      type: String,
      default: "",
      trim: true,
      maxlength: 255,
    },

    // --------------------------------------------------
    // Contact
    // --------------------------------------------------

    phone: {
      type: String,
      default: "",
      trim: true,
      validate: {
        validator(value) {
          if (!value) return true;
          return PHONE_REGEX.test(value);
        },
        message: "Please provide a valid phone number",
      },
    },

    website: {
      type: String,
      default: "",
      trim: true,
      maxlength: 2048,
      validate: {
        validator(value) {
          if (!value) return true;

          try {
            const url = new URL(value);
            return ["http:", "https:"].includes(url.protocol);
          } catch {
            return false;
          }
        },
        message: "Website must be a valid HTTP/HTTPS URL",
      },
    },

    // --------------------------------------------------
    // Skills
    // --------------------------------------------------

    skills: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 100,
        },
      ],
      default: [],
      validate: {
        validator(skills) {
          return skills.length <= 50;
        },
        message: "A user cannot have more than 50 skills",
      },
    },

    // --------------------------------------------------
    // Address / Location
    // --------------------------------------------------

    address: {
      type: String,
      default: "",
      trim: true,
      maxlength: [500, "Address cannot exceed 500 characters"],
    },

    location: {
      type: {
        type: String,
        enum: {
          values: [GEO_TYPE.POINT],
          message: "Location type must be Point",
        },
        required: function () {
          return !!this.location?.coordinates;
        },
      },

      coordinates: {
        type: [Number],
        required: function () {
          return !!this.location?.type;
        },
        validate: [
          {
            validator(coords) {
              return (
                Array.isArray(coords) &&
                coords.length === 2 &&
                coords.every(
                  (coordinate) =>
                    typeof coordinate === "number" &&
                    Number.isFinite(coordinate),
                )
              );
            },
            message:
              "Coordinates must be an array containing [longitude, latitude]",
          },
          {
            validator(coords) {
              if (!Array.isArray(coords) || coords.length !== 2) {
                return true;
              }

              const [longitude, latitude] = coords;

              return (
                longitude >= -180 &&
                longitude <= 180 &&
                latitude >= -90 &&
                latitude <= 90
              );
            },
            message:
              "Invalid coordinates. Longitude must be between -180 and 180 and latitude between -90 and 90",
          },
        ],
      },
    },

    // --------------------------------------------------
    // Verification
    // --------------------------------------------------

    isEmailVerified: {
      type: Boolean,
      default: false,
    },

    isPhoneVerified: {
      type: Boolean,
      default: false,
    },

    governmentVerificationStatus: {
      type: String,
      enum: {
        values: Object.values(VERIFICATION_STATUS),
        message: "Invalid government verification status",
      },
      default: VERIFICATION_STATUS.NONE,
    },

    // --------------------------------------------------
    // Account
    // --------------------------------------------------

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },

    lastSeen: {
      type: Date,
      default: Date.now,
    },

    isOnline: {
      type: Boolean,
      default: false,
      index: true,
    },

    // --------------------------------------------------
    // Relationships
    // --------------------------------------------------

    showcase: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER_SHOWCASE,
      default: null,
    },
  },
  {
    timestamps: true,

    // Prevent unexpected fields from being silently stored.
    strict: true,

    // Prevent returning internal MongoDB fields accidentally.
    toJSON: {
      transform(_doc, ret) {
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        delete ret.googleId;

        return ret;
      },
    },
  },
);

// --------------------------------------------------
// Indexes
// --------------------------------------------------

// Geospatial index.
// Only documents containing a valid Point participate.
userSchema.index(
  {
    location: "2dsphere",
  },
  {
    partialFilterExpression: {
      "location.type": GEO_TYPE.POINT,
      "location.coordinates": {
        $exists: true,
      },
    },
  },
);

// Google account must be unique when present.
userSchema.index(
  { googleId: 1 },
  {
    unique: true,
    sparse: true,
  },
);

// Useful if searching/filtering users by showcase.
userSchema.index({
  showcase: 1,
});

// --------------------------------------------------
// Cross-field validation
// --------------------------------------------------

userSchema.pre("validate", function (next) {
  // Location must either be completely absent
  // or be a valid GeoJSON Point.
  if (this.location) {
    const hasType = !!this.location.type;
    const hasCoordinates = Array.isArray(this.location.coordinates);

    if (hasType !== hasCoordinates) {
      return next(
        new mongoose.Error.ValidationError(
          new Error("Location must contain both type and coordinates"),
        ),
      );
    }
  }
});

// --------------------------------------------------
// Government verification consistency
// --------------------------------------------------

userSchema.pre("validate", function (next) {
  const verifiedStatus = VERIFICATION_STATUS.VERIFIED;

  if (
    this.governmentVerificationStatus === verifiedStatus &&
    this.isGovernmentVerified !== undefined &&
    this.isGovernmentVerified !== true
  ) {
    return next(
      new Error(
        "Government verification status and verification flag are inconsistent",
      ),
    );
  }
});

// --------------------------------------------------
// Password protection
// --------------------------------------------------

// IMPORTANT:
// Hash passwords before creating/updating users.
//
// Prefer doing this in the authentication/service layer.
// If you implement hashing here, use bcrypt/argon2 and make
// sure updateOne/findOneAndUpdate cannot bypass the hashing logic.

export default mongoose.model(MODEL_NAMES.USER, userSchema);
