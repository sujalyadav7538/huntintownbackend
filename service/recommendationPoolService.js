import { fetchCandidatePosts } from "./candidateService.js";
import { rankPosts } from "./rankingService.js";

const POOL_SIZE = 50;

const pools = new Map();

export const createRecommendationPool = async ({ user }) => {
  const posts = await fetchCandidatePosts({
    userId: user._id,
    userLocation: user.location,
  });

  if (!posts.length) {
    return null;
  }

  const ranked = await rankPosts({
    user,
    posts,
  });

  const postMap = new Map(posts.map((post) => [post._id.toString(), post]));

  const pool = ranked.map((item) => ({
    post: postMap.get(item.postId.toString()),
    score: item.score,
    breakdown: item.breakdown,
  }));

  pools.set(user._id.toString(), {
    posts: pool,
    position: 0,
  });

  return pools.get(user._id.toString());
};

export const getRecommendationPool = (userId) => {
  return pools.get(userId.toString());
};

export const removeRecommendationPool = (userId) => {
  pools.delete(userId.toString());
};
