import Metric from "../models/userMetricSchema.js";
import { calculateRecommendationScore } from "./recommendationService.js";

export const rankPosts = async ({ user, posts }) => {
  if (!posts.length) {
    return [];
  }

  const ownerIds = posts.map((post) => post.author?._id).filter(Boolean);

  const metrics = await Metric.find({
    user: {
      $in: ownerIds,
    },
  }).lean();

  const metricMap = new Map(
    metrics.map((metric) => [metric.user.toString(), metric]),
  );

  const rankedPosts = posts.map((post) => {
    const ownerMetric = metricMap.get(post.author?._id?.toString());

    const recommendation = calculateRecommendationScore({
      user,
      post,
      ownerMetric,
    });

    return {
      postId: post._id,
      score: recommendation.total,
      breakdown: recommendation.breakdown,
    };
  });

  rankedPosts.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }

    // Stable tie-breaker
    return a.postId.toString().localeCompare(b.postId.toString());
  });

  return rankedPosts;
};
