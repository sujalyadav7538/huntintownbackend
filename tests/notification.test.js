import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import Notification from "../models/notificationSchema.js";

process.env.REDIS_URL = "";
const { NotificationManager, setNotificationSocket } = await import("../utils/notificationManager.js");
const { getVapidPublicKey } = await import("../controllers/notificationController.js");

test("in-app notifications are emitted and retained when push cannot be queued", async (t) => {
  const saved = {
    _id: "notification-id",
    type: "SYSTEM",
    action: "TEST",
    title: "Test",
    message: "Message",
    data: {},
    link: null,
    isRead: false,
    createdAt: new Date("2026-01-01T00:00:00Z"),
  };
  t.mock.method(Notification, "create", async () => saved);
  const errors = [];
  t.mock.method(console, "error", (...args) => errors.push(args));
  const events = [];
  setNotificationSocket({
    to: (room) => ({ emit: (name, payload) => events.push({ room, name, payload }) }),
  });
  t.after(() => setNotificationSocket(null));

  const result = await NotificationManager.create("recipient-id", {
    type: saved.type,
    action: saved.action,
    title: saved.title,
    message: saved.message,
  });
  assert.equal(result, saved);
  assert.equal(events[0].room, "user:recipient-id");
  assert.equal(events[0].name, "notification-created");
  assert.equal(events[0].payload._id, saved._id);
  assert.equal(errors[0][1].code, "REDIS_NOT_CONFIGURED");
});

test("missing VAPID public key returns an explicit unavailable response", (t) => {
  const original = process.env.VAPID_PUBLIC_KEY;
  t.after(() => {
    if (original === undefined) delete process.env.VAPID_PUBLIC_KEY;
    else process.env.VAPID_PUBLIC_KEY = original;
  });
  delete process.env.VAPID_PUBLIC_KEY;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  getVapidPublicKey({}, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.success, false);
});

test("worker exits with actionable configuration errors instead of silently stopping", () => {
  const result = spawnSync(process.execPath, ["service/notification/notificationWorker.js"], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 10000,
    env: {
      ...process.env,
      REDIS_URL: "",
      MONGO_URI: "",
      VAPID_PUBLIC_KEY: "",
      VAPID_PRIVATE_KEY: "",
      VAPID_SUBJECT: "",
    },
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Notification worker missing configuration/);
  assert.match(result.stderr, /REDIS_URL/);
  assert.match(result.stderr, /VAPID_PRIVATE_KEY/);
});

test("queueing fails promptly when Redis is unreachable", () => {
  const script = `
    const { enqueueNotification } = await import("./service/notification/notificationQueue.js");
    const timeout = setTimeout(() => process.exit(2), 5000);
    try { await enqueueNotification("test"); process.exit(3); }
    catch { clearTimeout(timeout); process.exit(0); }
  `;
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    cwd: process.cwd(),
    encoding: "utf8",
    timeout: 8000,
    env: { ...process.env, REDIS_URL: "redis://127.0.0.1:1" },
  });
  assert.equal(result.status, 0, `Queue did not fail promptly: ${result.stderr}`);
});
