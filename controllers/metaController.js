import User from "../models/userSchema.js";
import {
  getClientIp,
  hashForMeta,
  isMetaConfigured,
  sendMetaEvent,
} from "../service/meta/metaConversions.js";

// Only events the frontend actually fires; anything else is rejected.
const ALLOWED_EVENTS = new Set([
  "PageView",
  "CompleteRegistration",
  "Lead",
  "SubmitApplication",
  "Search",
  "ViewContent",
]);

const ALLOWED_CUSTOM_KEYS = new Set([
  "content_name",
  "content_category",
  "content_ids",
  "content_type",
  "search_string",
  "registration_method",
]);

const clean = (value, max = 300) =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, max)
    : undefined;

const sanitizeCustomData = (params) => {
  if (!params || typeof params !== "object" || Array.isArray(params)) {
    return undefined;
  }
  const out = {};
  for (const [key, value] of Object.entries(params)) {
    if (!ALLOWED_CUSTOM_KEYS.has(key)) continue;
    if (key === "content_ids") {
      if (Array.isArray(value)) {
        out.content_ids = value.map((v) => clean(String(v), 64)).filter(Boolean).slice(0, 10);
      }
    } else {
      const v = clean(value);
      if (v) out[key] = v;
    }
  }
  return out;
};

export const trackEvent = async (req, res) => {
  const { eventName, eventId, eventSourceUrl, params, fbp, fbc } = req.body ?? {};

  if (!ALLOWED_EVENTS.has(eventName) || !clean(eventId, 100)) {
    return res.status(400).json({ success: false, message: "Invalid event" });
  }

  // Respond immediately; the browser doesn't need to wait for Meta.
  res.status(202).json({ success: true, queued: isMetaConfigured() });

  if (!isMetaConfigured()) return;

  let email;
  if (req.user?._id) {
    const user = await User.findById(req.user._id).select("email").lean().catch(() => null);
    email = user?.email;
  }

  await sendMetaEvent({
    eventName,
    eventId: clean(eventId, 100),
    eventSourceUrl: clean(eventSourceUrl, 1000),
    customData: sanitizeCustomData(params),
    userData: {
      em: hashForMeta(email),
      external_id: hashForMeta(req.user?._id),
      client_ip_address: getClientIp(req),
      client_user_agent: clean(req.headers["user-agent"], 500),
      fbp: clean(fbp, 200),
      fbc: clean(fbc, 500),
    },
  });
};
