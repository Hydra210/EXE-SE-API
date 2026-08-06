# Discord Server Stats API

Bot sits in your server, keeps live stats cached in memory, serves them over HTTP.
Hit `/api/server` from your site and build whatever custom embed you want.

## 1. Make the bot

1. Go to https://discord.com/developers/applications → New Application.
2. Bot tab → Add Bot → copy the **Token** (this is `BOT_TOKEN`).
3. Same Bot tab, scroll to **Privileged Gateway Intents** and turn ON:
   - Server Members Intent
   - Presence Intent (only needed if you want `onlineCount`, skip if you don't care)
4. OAuth2 → URL Generator → scopes: `bot`. Permissions: just `View Channels` is enough (this bot doesn't need to send messages).
5. Open the generated URL, invite it to your server.
6. Get your `GUILD_ID`: enable Developer Mode in Discord (User Settings → Advanced), right click your server icon → Copy Server ID.

## 2. Run it locally first (recommended before deploying)

```bash
npm install
cp .env.example .env
# fill in BOT_TOKEN and GUILD_ID in .env
npm start
```

Then hit `http://localhost:3000/api/server` and check you get real data back.

## 3. Deploy to Render

1. Push this folder to a GitHub repo.
2. Render dashboard → New → Web Service → connect the repo.
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Environment Variables:** add `BOT_TOKEN`, `GUILD_ID`, `ALLOWED_ORIGIN` (your site's domain, or `*` while testing) — do NOT commit your `.env` file, Render env vars are the safe way to set these.
4. Deploy. Once it's live you'll get a URL like `https://your-bot.onrender.com`.
5. Test: `https://your-bot.onrender.com/api/server`

## 4. Keeping it alive (free Render tier sleeps after 15 min idle)

Render's free web services spin down when idle, so you need something pinging it regularly:

- **Easiest:** [cron-job.org](https://cron-job.org) (free) → create a job that GETs `https://your-bot.onrender.com/` every 10 minutes. That's what the `/` route is for.
- **Alternative:** Render's own **Cron Jobs** feature (paid-tier feature on some plans) can run a `curl` on a schedule.
- **Alternative:** UptimeRobot monitor hitting the same `/` route, also doubles as uptime alerts for you.

10 minutes is safe since Render's sleep timer is 15 min of inactivity.

## API Reference

### `GET /api/server`
```json
{
  "id": "123456789",
  "name": "Your Server",
  "description": null,
  "icon": "https://cdn.discordapp.com/icons/....png",
  "banner": null,
  "memberCount": 482,
  "onlineCount": 61,
  "channelCount": 34,
  "channelBreakdown": { "text": 20, "voice": 8, "category": 5, "announcement": 1, "stage": 0, "forum": 0 },
  "roleCount": 12,
  "boostTier": 1,
  "boostCount": 3,
  "createdAt": "2021-04-02T18:22:11.000Z",
  "verificationLevel": 2,
  "vanityURLCode": null,
  "lastUpdated": "2026-08-06T20:15:00.000Z"
}
```

### `GET /api/channels`
Array of text/voice channels with `id`, `name`, `type`, `position`.

### `GET /`
Health check — returns `{ status: "alive", botReady: true }`. Point your keep-alive cron at this.

## Notes

- Stats refresh every 60s automatically, plus instantly on member join/leave and channel create/delete.
- `ALLOWED_ORIGIN` locks down CORS so randoms can't just curl your bot's data from anywhere — set it to your actual site domain once you're ready to go live.
- Never commit your real `.env` or paste your bot token anywhere public. If it ever leaks, regenerate it immediately in the dev portal.
