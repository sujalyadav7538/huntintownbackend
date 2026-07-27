import { BADGE_LEVELS } from "./constants.js";

export const BADGE_RULES = [
  {
    id: "PROFILE_COMPLETE",
    name: "Profile Complete",
    description: "Completed 100% profile information.",
    icon: "profile_complete",
    category: "profile",
    rarity: "common",
    level: BADGE_LEVELS.BRONZE,
    persistent: true,
    condition: (metric) => metric.profileMetrics.completion === 100,
  },

  {
    id: "TOP_RATED",
    name: "Top Rated",
    description: "Maintained 4.8+ rating with at least 20 reviews.",
    icon: "top_rated",
    category: "review",
    rarity: "epic",
    level: BADGE_LEVELS.GOLD,
    persistent: false,
    condition: (metric) =>
      metric.reviewMetrics.averageRating >= 4.8 &&
      metric.reviewMetrics.totalReviews >= 20,
  },

  {
    id: "TRUSTED_HELPER",
    name: "Trusted Helper",
    description: "Completed at least 25 offers with 95% completion.",
    icon: "trusted_helper",
    category: "helper",
    rarity: "rare",
    level: BADGE_LEVELS.SILVER,
    persistent: false,
    condition: (metric) =>
      metric.helperMetrics.completedOffers >= 25 &&
      metric.helperMetrics.completionScore >= 95,
  },

  {
    id: "POPULAR_HELPER",
    name: "Popular Helper",
    condition: (metric) =>
      metric.helperMetrics.offersAccepted >= 50 &&
      metric.helperMetrics.acceptanceScore >= 70,
  },

  {
    id: "ELITE_MEMBER",
    name: "Elite Member",
    condition: (metric) => metric.trustScore >= 90,
  },
];
