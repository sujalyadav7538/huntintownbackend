import calculateLocationScore from './recommendation/locationScore.js';
import calculateFreshnessScore from './recommendation/freshnessScore.js';
import calculateCategoryScore from './recommendation/categoryScore.js';
import calculateTrustScore from './recommendation/trustScore.js';
import calculateEngagementScore from './recommendation/engagementScore.js';
import calculateBudgetScore from './recommendation/budgetScore.js';


export function calculateRecommendationScore({ user, post, ownerMetric }) {
  const breakdown = {
    location: calculateLocationScore(user.location, post.location),

    freshness: calculateFreshnessScore(post.createdAt),

    category: calculateCategoryScore(user.skills, post.category),

    trust: calculateTrustScore(ownerMetric?.trustScore),

    engagement: calculateEngagementScore(post.applicants?.length ?? 0),

    budget: calculateBudgetScore(post.budget),
  };

  const total =
    breakdown.location +
    breakdown.freshness +
    breakdown.category +
    breakdown.trust +
    breakdown.engagement +
    breakdown.budget;

  return {
    total,
    breakdown,
  };
}
