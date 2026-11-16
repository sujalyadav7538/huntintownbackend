# HuntInTown backend

## Notifications on Render

Browser push requires the API, a Redis-compatible queue, and a separate,
continuously running BullMQ worker. Running `node index.js` does not start
the worker. In-app notifications are stored in MongoDB and sent to connected
users over Socket.IO independently of browser push.

1. Create a Render Key Value instance in the same region as the services. Set
   its maxmemory policy to `noeviction`. Use its internal connection URL in
   `REDIS_URL` for both services. For durable jobs use a persistent instance;
   free Key Value instances lose their data on restart.
2. Create a Render **Background Worker** from the backend repository. Set the
   root directory to the directory containing this `package.json`, build command
   `npm ci`, and start command `npm run worker:notification`. Render background
   workers do not have a free compute plan.
3. Configure both services with the same `MONGO_URI`, `REDIS_URL`, and
   `VAPID_PUBLIC_KEY`. Set `VAPID_PRIVATE_KEY` and `VAPID_SUBJECT` on the
   worker; the subject should be a valid `mailto:` address or HTTPS URL.
   The keys must be the same VAPID pair. Keep the private key and database
   credentials in Render environment variables, never in the frontend or
   source control. The API needs its other existing settings too, such as
   `JWT_SECRET`.
4. Deploy both services. In the worker logs, look for
   `[notifications] Worker ready`. Missing worker configuration fails at
   startup. Redis, queue, and push failures are logged without credentials.
5. On the production HTTPS site, sign in, open the notification bell, and
   enable or refresh browser push for that account. Browser permission and push
   subscriptions are specific to the site origin and browser. If VAPID keys
   change, refresh existing subscriptions. Never share private keys or push
   subscription endpoints when requesting help.

### Troubleshooting

- Check `GET /api/notifications/vapid-public-key` on the deployed API: it
  should return a public key; a 503 means the API key is missing.
- Check that `/sw.js` on the frontend returns JavaScript and that the browser
  has notification permission. In DevTools Network, check that
  `POST /api/notifications/subscribe` succeeds after enabling push.
- Trigger a new response or another notification for a different account.
  If it appears after refreshing the notification list but no push arrives,
  inspect API logs for `Could not enqueue push notification` and worker logs
  for `Push job failed`. HTTP 401/403 from the push provider can indicate
  mismatched VAPID keys; 404/410 subscriptions are removed as expired.
- If Redis is unavailable, the in-app notification remains saved, but that
  push is not queued automatically for later retry. Existing queued jobs retry
  up to three times. If there is no browser subscription, no push is sent.
- Render free web services sleep after inactivity, delaying API activity and
  the post-expiry scheduler. The scheduler runs in the API process, not the
  worker. A separate worker does not keep a free web service awake.

See [Render background workers](https://render.com/docs/background-workers),
[Render Key Value](https://render.com/docs/key-value), and
[BullMQ production guidance](https://docs.bullmq.io/guide/going-to-production).
