import { createHash } from "crypto";

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION || "v27.0";

export const isMetaConfigured = () =>
  Boolean(process.env.META_PIXEL_ID && process.env.META_ACCESS_TOKEN);

export const hashForMeta = (value) => {
  if (value === undefined || value === null) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return undefined;
  return createHash("sha256").update(normalized).digest("hex");
};

const PRIVATE_IP =
  /^(::1$|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|fc|fd|fe80)/i;

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  const raw = (
    (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0] ||
    req.socket?.remoteAddress ||
    ""
  ).trim();
  const ip = raw.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/, "");
  // Meta can't match on loopback/LAN addresses, so don't send them.
  return ip && !PRIVATE_IP.test(ip) ? ip : undefined;
};

/**
 * Sends one event to the Meta Conversions API.
 * Never throws: tracking failures must not affect the request that caused them.
 */
export const sendMetaEvent = async ({
  eventName,
  eventId,
  eventSourceUrl,
  userData = {},
  customData,
}) => {
  if (!isMetaConfigured()) return { skipped: true };

  const user_data = Object.fromEntries(
    Object.entries(userData).filter(([, v]) => v !== undefined && v !== ""),
  );

  const payload = {
    data: [
      {
        event_name: eventName,
        event_time: Math.floor(Date.now() / 1000),
        event_id: eventId,
        action_source: "website",
        event_source_url: eventSourceUrl,
        user_data,
        ...(customData && Object.keys(customData).length
          ? { custom_data: customData }
          : {}),
      },
    ],
    ...(process.env.META_TEST_EVENT_CODE
      ? { test_event_code: process.env.META_TEST_EVENT_CODE }
      : {}),
  };

  const url =
    `https://graph.facebook.com/${GRAPH_API_VERSION}/` +
    `${encodeURIComponent(process.env.META_PIXEL_ID)}/events` +
    `?access_token=${encodeURIComponent(process.env.META_ACCESS_TOKEN)}`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error(
        `[meta-capi] ${eventName} rejected (${res.status}):`,
        body?.error?.message || body,
      );
      return { ok: false, status: res.status, body };
    }
    if (process.env.META_TEST_EVENT_CODE) {
      console.log(
        `[meta-capi] ${eventName} sent (events_received=${body.events_received})`,
      );
    }
    return { ok: true, body };
  } catch (error) {
    console.error(`[meta-capi] ${eventName} failed:`, error.message);
    return { ok: false, error };
  }
};
