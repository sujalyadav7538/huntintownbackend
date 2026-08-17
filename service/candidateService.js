import Post from "../models/postSchema.js";
import Response from "../models/responseSchema.js";
import { POST_STATUS } from "../config/constants.js";

const CANDIDATE_LIMIT = 50;
const DEFAULT_RADIUS_KM = 5;

export const fetchCandidatePosts = async ({ userId, userLocation }) => {
  // Posts where the user has already submitted an offer
  const appliedResponses = await Response.find({
    respondedBy: userId,
  })
    .select("postId")
    .lean();

  const appliedPostIds = appliedResponses.map((r) => r.postId);

  const filter = {
    author: {
      $ne: userId,
    },

    _id: {
      $nin: appliedPostIds,
    },

    status: {
      $in: [POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS],
    },

    // Never surface expired posts in candidates.
    $or: [
      { expiresAt: { $exists: false } },
      { expiresAt: null },
      { expiresAt: { $gt: new Date() } },
    ],
  };

  // Apply location filter only when user has a valid location
  if (userLocation?.coordinates?.length === 2) {
    filter.location = {
      $geoWithin: {
        $centerSphere: [userLocation.coordinates, DEFAULT_RADIUS_KM / 6378.1],
      },
    };
  }

  return Post.find(filter)
    .populate("author", "name avatar location role")
    .limit(CANDIDATE_LIMIT)
    .lean();
};
