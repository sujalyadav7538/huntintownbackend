import mongoose from "mongoose";
import { MODEL_NAMES } from "../config/constants.js";

const userMetricSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: MODEL_NAMES.USER,
      required: true,
      unique: true,
      index: true,
    },

    // Review & Rating
    reviewMetrics: {
      averageRating: {
        type: Number,
        default: 0,
      },

      totalReviews: {
        type: Number,
        default: 0,
      },

      totalStars: {
        type: Number,
        default: 0,
      },

      score: {
        type: Number,
        default: 0,
      },
    },

    // Profile
    profileMetrics: {
      completion: {
        type: Number,
        default: 0,
      },

      score: {
        type: Number,
        default: 0,
      },
    },

    // Helper Performance
    helperMetrics: {
      responsesSubmitted: {
        type: Number,
        default: 0,
      },

      responsesAccepted: {
        type: Number,
        default: 0,
      },

      acceptanceScore: {
        type: Number,
        default: 0,
      },

      completedResponses: {
        type: Number,
        default: 0,
      },

      cancelledResponses: {
        type: Number,
        default: 0,
      },

      completionScore: {
        type: Number,
        default: 0,
      },
    },

    // Future
    hunterMetrics: {
      postsCreated: {
        type: Number,
        default: 0,
      },

      postsCompleted: {
        type: Number,
        default: 0,
      },

      postsCancelled: {
        type: Number,
        default: 0,
      },

      completionScore: {
        type: Number,
        default: 0,
      },

      responsesReceived: {
        type: Number,
        default: 0,
      },

      responsesAccepted: {
        type: Number,
        default: 0,
      },

      acceptanceScore: {
        type: Number,
        default: 0,
      },
    },

    responseMetrics: {
      hunter: {
        totalResponseTime: {
          type: Number, // Minutes
          default: 0,
        },

        totalResponses: {
          type: Number,
          default: 0,
        },

        averageResponseTime: {
          type: Number,
          default: 0,
        },
        responseScore: Number,
      },

      helper: {
        totalResponseTime: {
          type: Number, // Minutes
          default: 0,
        },

        totalResponses: {
          type: Number,
          default: 0,
        },

        averageResponseTime: {
          type: Number,
          default: 0,
        },
        responseScore: Number,
      },
    },

    activityMetrics: {
      activeDays: {
        type: Number,
        default: 0,
      },

      postsCreated: {
        type: Number,
        default: 0,
      },

      responsesSubmitted: {
        type: Number,
        default: 0,
      },

      conversationsStarted: {
        type: Number,
        default: 0,
      },

      lastActiveAt: {
        type: Date,
        default: null,
      },
    },

    
    verificationMetrics: {},

    penaltyMetrics: {},

    // Final Trust Score (0-100)
    trustScore: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  },
);

export default mongoose.model(MODEL_NAMES.METRIC, userMetricSchema);
