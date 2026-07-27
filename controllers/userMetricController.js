// metric.service.ts
import User from "../models/userSchema.js";
import Metric from "../models/userMetricSchema.js";
import UserBadge from "../models/userBadgeSchema.js";
import { BADGE_RULES } from "../config/badgeRules.js";
import {
  METRIC_TYPES,
  ACTIONS,
  ROLES,
} from "../config/constants.js";

/**
 * Dispatch a single metric update (no trust-score/badge side-effects).
 * Returns an array of userIds that need trust-score/badge refresh
 * (usually [userId], but responseMetrics can return other users).
 */
const dispatchMetricUpdate = async (userId, update, session) => {
  const { type, ...payload } = update;

  switch (type) {
    case METRIC_TYPES.PROFILE:
      await updateProfileMetric(userId, session);
      return [userId];

    case METRIC_TYPES.REVIEW:
      await updateReviewMetric(userId, payload.rating, session);
      return [userId];

    case METRIC_TYPES.HELPER:
      await updateHelperMetric(userId, payload.action, session);
      return [userId];

    case METRIC_TYPES.HUNTER:
      await updateHunterMetric(userId, payload.action, session);
      return [userId];

    case METRIC_TYPES.ACTIVITY:
      await updateActivityMetric(userId, payload.action, session);
      return [userId];

    case METRIC_TYPES.RESPONSE: {
      const affectedUserId = await updateResponseMetric(
        payload.conversation,
        payload.message,
      );
      return affectedUserId ? [affectedUserId] : [];
    }

    default:
      throw new Error(`Unknown metric type: ${type}`);
  }
};

/**
 * Batch metric update.
 * Pass an array of update descriptors — each is { type, ...payload }.
 * All metrics are updated first, then trust-score and badges are
 * recalculated once per affected user.
 *
 * @example
 * await updateUserMetrics(userId, [
 *   { type: "activityMetrics", action: "offerSubmitted" },
 *   { type: "helperMetrics",   action: "submitted" },
 * ], session);
 */
export const updateUserMetrics = async (
  userId,
  updates = [],
  session = null,
) => {
  const affectedIds = new Set();

  for (const update of updates) {
    const ids = await dispatchMetricUpdate(userId, update, session);
    ids.forEach((id) => affectedIds.add(id.toString()));
  }

  for (const id of affectedIds) {
    await updateTrustScore(id, session);
    await updateUserBadges(id, session);
  }
};

/**
 * Single-update convenience wrapper (backward-compatible).
 */
export const updateUserMetric = async (
  userId,
  metricType,
  payload = {},
  session = null,
) => {
  return updateUserMetrics(userId, [{ type: metricType, ...payload }], session);
};

// Trust score calculation
export const updateReviewMetric = async (userId, rating, session = null) => {
  let metric = await Metric.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session },
  );

  const totalStars = metric.reviewMetrics.totalStars + rating;
  const totalReviews = metric.reviewMetrics.totalReviews + 1;
  const averageRating = totalStars / totalReviews;

  metric.reviewMetrics.totalStars = totalStars;
  metric.reviewMetrics.totalReviews = totalReviews;
  metric.reviewMetrics.averageRating = averageRating;

  await metric.save({ session });

  return metric;
};

// Profile completion metric calculation
const PROFILE_WEIGHTS = {
  avatar: 10,
  coverImage: 5,
  name: 5,
  bio: 10,
  role: 5,
  address: 10,
  location: 10,
  phone: 5,
  website: 5,
  skills: 10,
  emailVerified: 10,
  phoneVerified: 10,
  governmentVerified: 15,
};
export const updateProfileMetric = async (userId, session = null) => {
  const user = await User.findById(userId).session(session);

  if (!user) {
    throw new Error("User not found");
  }

  let completion = 0;

  if (user.avatar) completion += PROFILE_WEIGHTS.avatar;

  if (user.coverImage) completion += PROFILE_WEIGHTS.coverImage;

  if (user.name?.trim()) completion += PROFILE_WEIGHTS.name;

  if (user.bio?.trim()) completion += PROFILE_WEIGHTS.bio;

  if (user.role?.trim()) completion += PROFILE_WEIGHTS.role;

  if (user.address?.trim()) completion += PROFILE_WEIGHTS.address;

  if (user.location?.coordinates?.length === 2)
    completion += PROFILE_WEIGHTS.location;

  if (user.phone?.trim()) completion += PROFILE_WEIGHTS.phone;

  if (user.website?.trim()) completion += PROFILE_WEIGHTS.website;

  if (user.skills?.length > 0) completion += PROFILE_WEIGHTS.skills;

  if (user.isEmailVerified) completion += PROFILE_WEIGHTS.emailVerified;

  if (user.isPhoneVerified) completion += PROFILE_WEIGHTS.phoneVerified;

  if (user.isGovernmentVerified)
    completion += PROFILE_WEIGHTS.governmentVerified;

  const metric = await Metric.findOneAndUpdate(
    { userId },
    {
      $set: {
        "profileMetrics.completion": completion,
      },
    },
    {
      new: true,
      upsert: true,
      session,
    },
  );

  return metric;
};

// Update trust score based on review and profile metrics
export const updateTrustScore = async (userId, session = null) => {
  const metric = await Metric.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session },
  );

  // ---------------- Review ----------------
  const reviewScore =
    metric.reviewMetrics.totalReviews === 0
      ? 0
      : (metric.reviewMetrics.averageRating / 5) * 100;

  metric.reviewMetrics.score = Number(reviewScore.toFixed(2));

  // ---------------- Profile ----------------
  const profileScore = metric.profileMetrics.completion;

  metric.profileMetrics.score = Number(profileScore.toFixed(2));

  // ---------------- Helper ----------------
  const helperScore =
    metric.helperMetrics.acceptanceScore * 0.4 +
    metric.helperMetrics.completionScore * 0.6;

  metric.helperMetrics.score = Number(helperScore.toFixed(2));

  // ---------------- Hunter ----------------
  const hunterScore =
    metric.hunterMetrics.acceptanceScore * 0.4 +
    metric.hunterMetrics.completionScore * 0.6;

  metric.hunterMetrics.score = Number(hunterScore.toFixed(2));

  // ---------------- Response ----------------
  const hunterAvg = metric.responseMetrics.hunter.averageResponseTime;
  const helperAvg = metric.responseMetrics.helper.averageResponseTime;

  // 0-100 score (0 min = 100, 1440 min = 0)
  const hunterResponseScore =
    metric.responseMetrics.hunter.totalResponses === 0
      ? 0
      : Math.max(0, 100 - (hunterAvg / 1440) * 100);

  const helperResponseScore =
    metric.responseMetrics.helper.totalResponses === 0
      ? 0
      : Math.max(0, 100 - (helperAvg / 1440) * 100);

  const responseScore = Number(
    ((hunterResponseScore + helperResponseScore) / 2).toFixed(2),
  );

  metric.responseMetrics.score = responseScore;

  // ---------------- Final Trust Score ----------------
  const trustScore =
    reviewScore * 0.3 +
    profileScore * 0.1 +
    helperScore * 0.2 +
    hunterScore * 0.2 +
    responseScore * 0.2;

  metric.trustScore = Number(trustScore.toFixed(2));

  await metric.save({ session });

  return metric.trustScore;
};

// Helper action metric calculation
export const updateHelperMetric = async (userId, action, session = null) => {
  const metric = await Metric.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session },
  );

  switch (action) {
    case ACTIONS.OFFER_SUBMITTED:
      metric.helperMetrics.offersSubmitted++;
      break;

    case ACTIONS.OFFER_ACCEPTED:
      metric.helperMetrics.offersAccepted++;
      break;

    case ACTIONS.OFFER_COMPLETED:
      metric.helperMetrics.completedOffers++;
      break;

    case ACTIONS.OFFER_CANCELLED:
      metric.helperMetrics.cancelledOffers++;
      break;

    default:
      throw new Error("Invalid Helper Action");
  }

  // Acceptance Score
  metric.helperMetrics.acceptanceScore =
    metric.helperMetrics.offersSubmitted === 0
      ? 0
      : Number(
          (
            (metric.helperMetrics.offersAccepted /
              metric.helperMetrics.offersSubmitted) *
            100
          ).toFixed(2),
        );

  // Completion Score
  metric.helperMetrics.completionScore =
    metric.helperMetrics.offersAccepted === 0
      ? 0
      : Number(
          (
            (metric.helperMetrics.completedOffers /
              metric.helperMetrics.offersAccepted) *
            100
          ).toFixed(2),
        );

  await metric.save({ session });

  return metric;
};

// Hunter action metric calculation
export const updateHunterMetric = async (userId, action, session = null) => {
  const metric = await Metric.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session },
  );

  switch (action) {
    case ACTIONS.POST_CREATED:
      metric.hunterMetrics.postsCreated++;
      break;

    case ACTIONS.OFFER_RECEIVED:
      metric.hunterMetrics.offersReceived++;
      break;

    case ACTIONS.OFFER_ACCEPTED:
      metric.hunterMetrics.offersAccepted++;
      break;

    case ACTIONS.POST_COMPLETED:
      metric.hunterMetrics.postsCompleted++;
      break;

    case ACTIONS.POST_CANCELLED:
      metric.hunterMetrics.postsCancelled++;
      break;

    default:
      throw new Error("Invalid Hunter Action");
  }

  // Acceptance Score
  metric.hunterMetrics.acceptanceScore =
    metric.hunterMetrics.offersReceived === 0
      ? 0
      : Number(
          (
            (metric.hunterMetrics.offersAccepted /
              metric.hunterMetrics.offersReceived) *
            100
          ).toFixed(2),
        );

  // Completion Score
  metric.hunterMetrics.completionScore =
    metric.hunterMetrics.postsCreated === 0
      ? 0
      : Number(
          (
            (metric.hunterMetrics.postsCompleted /
              metric.hunterMetrics.postsCreated) *
            100
          ).toFixed(2),
        );

  await metric.save({ session });

  return metric;
};

// Helper Function to update user badges.
export const updateUserBadges = async (userId, session = null) => {
  const metric = await Metric.findOne({ userId }).session(session);

  if (!metric) {
    throw new Error("Metric not found");
  }

  let userBadge = await UserBadge.findOne({ userId }).session(session);

  if (!userBadge) {
    userBadge = new UserBadge({
      userId,
      badges: [],
    });
  }

  const badgeMap = new Map();

  userBadge.badges.forEach((badge) => {
    badgeMap.set(`${badge.badgeId}:${badge.level}`, badge);
  });

  const updatedBadges = [];

  for (const rule of BADGE_RULES) {
    const key = `${rule.id}:${rule.level}`;

    const qualifies = rule.condition(metric);

    if (qualifies) {
      if (badgeMap.has(key)) {
        updatedBadges.push(badgeMap.get(key));
      } else {
        updatedBadges.push({
          badgeId: rule.id,
          level: rule.level,
          earnedAt: new Date(),
        });
      }
    } else if (rule.persistent && badgeMap.has(key)) {
      updatedBadges.push(badgeMap.get(key));
    }
  }

  userBadge.badges = updatedBadges;

  await userBadge.save({ session });

  return userBadge;
};

export const getBadgeMetadata = (badgeId) => {
  return BADGE_RULES.find((badge) => badge.id === badgeId);
};

// Response metric calculation.
// Accepts the already-loaded conversation document — no re-fetch needed.
// Mutates conversation.responseTracking in-memory and persists it.
// Returns the userId whose metric was updated, or null if no update was needed.
// The dispatcher (updateUserMetric) is responsible for running the
// trust-score / badge pipeline on the returned userId.
export const updateResponseMetric = async (conversation, message) => {
  const tracking = conversation.responseTracking;

  // Both parties already recorded — nothing to do
  if (tracking.hunterCompleted && tracking.helperCompleted) return null;

  let metricUpdate = null;

  if (!tracking.firstMessageAt) {
    // First message after offer acceptance
    const responseTime = Math.max(
      0,
      Math.ceil((message.createdAt - tracking.acceptedAt) / (1000 * 60)),
    );

    if (
      conversation.hunter.equals(message.sender) &&
      !tracking.hunterCompleted
    ) {
      tracking.hunterCompleted = true;
      metricUpdate = {
        userId: conversation.hunter,
        role: "hunter",
        responseTime,
      };
    } else if (
      conversation.helper.equals(message.sender) &&
      !tracking.helperCompleted
    ) {
      tracking.helperCompleted = true;
      metricUpdate = {
        userId: conversation.helper,
        role: "helper",
        responseTime,
      };
    }

    tracking.firstMessageAt = message.createdAt;
  } else {
    const isHunterResponding =
      conversation.hunter.equals(message.sender) && !tracking.hunterCompleted;
    const isHelperResponding =
      conversation.helper.equals(message.sender) && !tracking.helperCompleted;

    if (isHunterResponding || isHelperResponding) {
      // Second participant's first response — measure from last unanswered message
      const responseTime = Math.max(
        0,
        Math.ceil((message.createdAt - tracking.firstMessageAt) / (1000 * 60)),
      );

      if (isHunterResponding) {
        tracking.hunterCompleted = true;
        metricUpdate = {
          userId: conversation.hunter,
          role: "hunter",
          responseTime,
        };
      } else {
        tracking.helperCompleted = true;
        metricUpdate = {
          userId: conversation.helper,
          role: "helper",
          responseTime,
        };
      }
    } else {
      // Same sender again before the other responds — roll timestamp forward
      // so second person's response time is from the most recent message
      tracking.firstMessageAt = message.createdAt;
    }
  }

  await conversation.save();

  if (metricUpdate) {
    await updateuserResponseMetric(
      metricUpdate.userId,
      metricUpdate.role,
      metricUpdate.responseTime,
    );
    return metricUpdate.userId;
  }

  return null;
};
export const updateuserResponseMetric = async (
  userId,
  role,
  responseTime,
  session = null,
) => {
  const metric = await Metric.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    { new: true, upsert: true, session },
  );

  let responseMetric;

  switch (role) {
    case ROLES.HUNTER:
      responseMetric = metric.responseMetrics.hunter;
      break;

    case ROLES.HELPER:
      responseMetric = metric.responseMetrics.helper;
      break;

    default:
      throw new Error("Invalid response role");
  }

  // Ensure a valid non-negative response time
  responseTime = Math.max(0, Number(responseTime));

  responseMetric.totalResponses += 1;
  responseMetric.totalResponseTime += responseTime;

  responseMetric.averageResponseTime = Number(
    (responseMetric.totalResponseTime / responseMetric.totalResponses).toFixed(
      2,
    ),
  );

  await metric.save({ session });

  return responseMetric;
};

// Activity Metrics Calculation
export const updateActivityMetric = async (userId, action, session = null) => {
  const metric = await Metric.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId } },
    {
      new: true,
      upsert: true,
      session,
    },
  );

  const activity = metric.activityMetrics;
  const now = new Date();

  // ---------------------------------
  // Active Days (count only once/day)
  // ---------------------------------
  if (
    !activity.lastActiveAt ||
    activity.lastActiveAt.toDateString() !== now.toDateString()
  ) {
    activity.activeDays++;
  }

  // ---------------------------------
  // Update Activity Counters
  // ---------------------------------
  switch (action) {
    case ACTIONS.POST_CREATED:
      activity.postsCreated++;
      break;

    case ACTIONS.OFFER_SUBMITTED:
      activity.offersSubmitted++;
      break;

    case ACTIONS.CONVERSATION_STARTED:
      activity.conversationsStarted++;
      break;

    case ACTIONS.LOGIN:
    case ACTIONS.OFFER_ACCEPTED:
    case ACTIONS.OFFER_COMPLETED:
    case ACTIONS.OFFER_CANCELLED:
    case ACTIONS.POST_COMPLETED:
    case ACTIONS.POST_CANCELLED:
    case ACTIONS.MESSAGE_SENT:
    case ACTIONS.REVIEW_SUBMITTED:
    case ACTIONS.PROFILE_UPDATED:
      // These actions only refresh activeDays / lastActiveAt — no dedicated counter.
      break;

    default:
      throw new Error(`Invalid activity action: ${action}`);
  }

  // ---------------------------------
  // Last Active
  // ---------------------------------
  activity.lastActiveAt = now;

  await metric.save({ session });

  return activity;
};
