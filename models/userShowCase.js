import { MODEL_NAMES } from "../config/constants";

const showcaseItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },

    type: {
      type: String,
      enum: [
        "project",
        "business",
        "shop",
        "service",
        "portfolio",
        "achievement",
        "product",
      ],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    subtitle: {
      type: String,
      default: "",
    },

    organization: {
      type: String,
      default: "",
    },

    role: {
      type: String,
      default: "",
    },

    location: {
      type: String,
      default: "",
    },

    description: {
      type: String,
      maxlength: 2000,
      default: "",
    },

    currentlyActive: {
      type: Boolean,
      default: false,
    },

    startDate: Date,

    endDate: Date,

    coverImage: {
      type: String,
      default: "",
    },

    coverImage_public_id: {
      type: String,
      default: "",
    },

    gallery: [
      {
        image: String,
        public_id: String,
      },
    ],

    skills: [
      {
        type: String,
        trim: true,
      },
    ],

    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    links: [
      {
        label: String,
        url: String,
      },
    ],

    stats: {
      views: {
        type: Number,
        default: 0,
      },

      likes: {
        type: Number,
        default: 0,
      },

      appreciations: {
        type: Number,
        default: 0,
      },
    },

    featured: {
      type: Boolean,
      default: false,
    },

    visibility: {
      type: String,
      enum: ["public", "followers", "private"],
      default: "public",
    },

    order: {
      type: Number,
      default: 0,
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

export const UserShowcase = mongoose.model(
  MODEL_NAMES.USER_SHOWCASE,
  userShowcaseSchema,
);
