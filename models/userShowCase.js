import mongoose from "mongoose";
import { MODEL_NAMES } from "../config/constants.js";

const showcaseLinkSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      trim: true,
      maxlength: 50,
    },

    url: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  { _id: false },
);

const showcaseMediaSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },

    public_id: {
      type: String,
      default: "",
    },
  },
  { _id: false },
);

const showcaseItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    /*
     * Defines what kind of proof this showcase item represents.
     */
    type: {
      type: String,
      enum: [
        "work",
        "project",
        "service",
        "business",
        "achievement",
        "skill",
        "experience",
        "product",
        "portfolio",
        "other",
      ],
      required: true,
    },

    /*
     * Main display information
     */
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    subtitle: {
      type: String,
      trim: true,
      maxlength: 160,
      default: "",
    },

    description: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: "",
    },

    /*
     * Context / attribution
     */
    organization: {
      type: String,
      trim: true,
      maxlength: 120,
      default: "",
    },

    role: {
      type: String,
      trim: true,
      maxlength: 100,
      default: "",
    },

    location: {
      type: String,
      trim: true,
      maxlength: 150,
      default: "",
    },

    /*
     * Time period
     *
     * Useful for work, experience, projects, businesses, etc.
     */
    currentlyActive: {
      type: Boolean,
      default: false,
    },

    startDate: {
      type: Date,
      default: null,
    },

    endDate: {
      type: Date,
      default: null,
    },

    /*
     * Visual proof
     */
    coverImage: {
      type: String,
      default: "",
    },

    coverImage_public_id: {
      type: String,
      default: "",
    },

    gallery: {
      type: [showcaseMediaSchema],
      default: [],
    },

    /*
     * Skills demonstrated through this item
     */
    skills: {
      type: [String],
      default: [],
    },

    /*
     * Search / categorization tags
     */
    tags: {
      type: [String],
      default: [],
    },

    /*
     * External proof / references
     *
     * Examples:
     * - GitHub
     * - Live project
     * - LinkedIn
     * - Website
     * - Certificate
     */
    links: {
      type: [showcaseLinkSchema],
      default: [],
    },

    /*
     * Optional structured information.
     *
     * Keeps the main schema flexible without adding dozens
     * of type-specific fields.
     */
    metadata: {
      company: {
        type: String,
        trim: true,
        default: "",
      },

      client: {
        type: String,
        trim: true,
        default: "",
      },

      credential: {
        type: String,
        trim: true,
        default: "",
      },

      year: {
        type: String,
        trim: true,
        default: "",
      },

      duration: {
        type: String,
        trim: true,
        default: "",
      },

      result: {
        type: String,
        trim: true,
        default: "",
      },

      category: {
        type: String,
        trim: true,
        default: "",
      },
    },
    
  },
  {
    _id: false,
  },
);

const userShowcaseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
      unique: true,
      index: true,
    },

    items: {
      type: [showcaseItemSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  },
);

const UserShowcase = mongoose.model(
  MODEL_NAMES.USER_SHOWCASE,
  userShowcaseSchema,
);

export default UserShowcase;
