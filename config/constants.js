/**
 * Single source of truth for every string constant in the application.
 * Import from here — never hard-code these strings anywhere else.
 */

// ── Mongoose model / collection names ────────────────────────────────────────
export const MODEL_NAMES = {
  USER: "User",
  POST: "Post",
  RESPONSE: "Response",
  CONVERSATION: "Conversation",
  MESSAGE: "Message",
  RATING: "Rating",
  METRIC: "Metric",
  USER_BADGE: "UserBadge",
  USER_SHOWCASE: "UserShowcase",
};

// ── GeoJSON ───────────────────────────────────────────────────────────────────
export const GEO_TYPE = {
  POINT: "Point",
};

// ── Response status ─────────────────────────────────────────────────────────
export const RESPONSE_STATUS = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

// ── Post status ───────────────────────────────────────────────────────────────
export const POST_STATUS = {
  LIVE: "live",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
  EXPIRED: "expired",
  CANCELLED: "cancelled",
};

// ── Post type ─────────────────────────────────────────────────────────────────
export const POST_TYPE = {
  HELP_NEEDED: "help_needed",
  OFFER_HELP: "offer_help",
};

// ── Conversation status ───────────────────────────────────────────────────────
export const CONVERSATION_STATUS = {
  ACTIVE: "active",
  CLOSED: "closed",
};

// ── User government verification status ──────────────────────────────────────
export const VERIFICATION_STATUS = {
  NONE: "none",
  PENDING: "pending",
  VERIFIED: "verified",
  REJECTED: "rejected",
};

// ── Badge levels ──────────────────────────────────────────────────────────────
export const BADGE_LEVELS = {
  BRONZE: "bronze",
  SILVER: "silver",
  GOLD: "gold",
};

// ── Metric types (passed as `type` in updateUserMetrics descriptors) ──────────
export const METRIC_TYPES = {
  PROFILE: "profileMetrics",
  REVIEW: "reviewMetrics",
  HELPER: "helperMetrics",
  HUNTER: "hunterMetrics",
  ACTIVITY: "activityMetrics",
  RESPONSE: "responseMetrics",
};

// ── Actions (shared across all metric types — differentiated by `type`) ──────
export const ACTIONS = {
  // Response lifecycle
  RESPONSE_SUBMITTED: "response_submitted",
  RESPONSE_ACCEPTED: "response_accepted",
  RESPONSE_COMPLETED: "response_completed",
  RESPONSE_CANCELLED: "response_cancelled",
  RESPONSE_RECEIVED: "response_received",   // hunter: a new response landed on their post

  // Post lifecycle
  POST_CREATED: "post_created",
  POST_COMPLETED: "post_completed",
  POST_CANCELLED: "post_cancelled",

  // General user activity
  LOGIN: "login",
  MESSAGE_SENT: "message_sent",
  REVIEW_SUBMITTED: "review_submitted",
  PROFILE_UPDATED: "profile_updated",
  CONVERSATION_STARTED: "conversation_started",
};

// ── Response metric roles ─────────────────────────────────────────────────────
export const ROLES = {
  HUNTER: "hunter",
  HELPER: "helper",
};
