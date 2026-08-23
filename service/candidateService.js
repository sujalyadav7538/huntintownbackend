import Post from "../models/postSchema.js";
import Response from "../models/responseSchema.js";
import { GEO_TYPE, POST_STATUS } from "../config/constants.js";

const CANDIDATE_LIMIT = 50;
const DEFAULT_RADIUS_KM = 5;

export const fetchCandidatePosts = async ({ userId, userLocation }) => {
  // Find posts on which the user has already responded.
  const appliedResponses = await Response.find({
    respondedBy: userId,
  })
    .select("postId -_id")
    .lean();

  const appliedPostIds = appliedResponses.map(({ postId }) => postId);

  const filter = {
    // Don't show user's own posts
    author: {
      $ne: userId,
    },

    // Don't show posts where user has already responded
    _id: {
      $nin: appliedPostIds,
    },

    // Only active candidate posts
    status: {
      $in: [POST_STATUS.LIVE, POST_STATUS.IN_PROGRESS],
    },

    // Don't show expired posts
    expiresAt: {
      $gt: new Date(),
    },
  };

  // Apply location filter when valid user location exists
  if (
    userLocation?.type === GEO_TYPE.POINT &&
    Array.isArray(userLocation.coordinates) &&
    userLocation.coordinates.length === 2
  ) {
    const [longitude, latitude] = userLocation.coordinates;

    const validLocation =
      Number.isFinite(longitude) &&
      Number.isFinite(latitude) &&
      longitude >= -180 &&
      longitude <= 180 &&
      latitude >= -90 &&
      latitude <= 90;

    if (validLocation) {
      filter.location = {
        $geoWithin: {
          $centerSphere: [[longitude, latitude], DEFAULT_RADIUS_KM / 6378.1],
        },
      };
    }
  }

  return Post.find(filter)
    .populate({
      path: "author",
      select: "-_id id name avatar location role",
    })
    .sort({
      createdAt: -1,
    })
    .limit(CANDIDATE_LIMIT)
    .lean();
};
