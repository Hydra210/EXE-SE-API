// ============================================================
//  Discord Server Stats API
//  Bot logs into your server, keeps live stats in memory,
//  and serves them up over HTTP so your website can fetch them.
//  Built for: Nexesmere / EXE Development
// ============================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Client, GatewayIntentBits, Partials } = require('discord.js');

const {
  BOT_TOKEN,
  GUILD_ID,
  PORT = 3000,
  ALLOWED_ORIGIN = '*', // lock this down to your site's domain in prod
} = process.env;

if (!BOT_TOKEN || !GUILD_ID) {
  console.error('[FATAL] Missing BOT_TOKEN or GUILD_ID in your .env file. Fix that first.');
  process.exit(1);
}

// ---------------------------------------------
// Discord client setup
// ---------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers, // requires "Server Members Intent" toggle ON in dev portal
    GatewayIntentBits.GuildPresences, // requires "Presence Intent" toggle ON (for online count)
  ],
  partials: [Partials.GuildMember],
});

let cachedStats = null;
let lastUpdated = null;

// ---------------------------------------------
// Build the stats payload from the live guild
// ---------------------------------------------
async function buildStats() {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) throw new Error(`Bot isn't in guild ${GUILD_ID}, or GUILD_ID is wrong.`);

  // force a fresh fetch so member/channel counts aren't stale
  await guild.fetch();
  const channels = guild.channels.cache;
  const roles = guild.roles.cache;

  const channelBreakdown = {
    text: channels.filter(c => c.type === 0).size,
    voice: channels.filter(c => c.type === 2).size,
    category: channels.filter(c => c.type === 4).size,
    announcement: channels.filter(c => c.type === 5).size,
    stage: channels.filter(c => c.type === 13).size,
    forum: channels.filter(c => c.type === 15).size,
  };

  const onlineCount = guild.members.cache.filter(
    m => m.presence && m.presence.status !== 'offline'
  ).size;

  return {
    id: guild.id,
    name: guild.name,
    description: guild.description || null,
    icon: guild.iconURL({ size: 256 }) || null,
    banner: guild.bannerURL({ size: 512 }) || null,
    memberCount: guild.memberCount,
    onlineCount,
    channelCount: channels.size,
    channelBreakdown,
    roleCount: roles.size,
    boostTier: guild.premiumTier,
    boostCount: guild.premiumSubscriptionCount,
    createdAt: guild.createdAt,
    verificationLevel: guild.verificationLevel,
    vanityURLCode: guild.vanityURLCode || null,
  };
}

async function refreshCache() {
  try {
    cachedStats = await buildStats();
    lastUpdated = new Date().toISOString();
  } catch (err) {
    console.error('[refreshCache] failed:', err.message);
  }
}

// ---------------------------------------------
// Express API
// ---------------------------------------------
const app = express();
app.use(cors({ origin: ALLOWED_ORIGIN }));

// simple root/health check - also what your cron job pings to keep it alive
app.get('/', (req, res) => {
  res.json({ status: 'alive', botReady: client.isReady() });
});

// the actual data your embed will fetch
app.get('/api/server', async (req, res) => {
  if (!cachedStats) {
    return res.status(503).json({ error: 'Stats not ready yet, try again in a few seconds.' });
  }
  res.json({ ...cachedStats, lastUpdated });
});

// bonus: list channels individually (names + type + position), useful for fancier embeds
app.get('/api/channels', (req, res) => {
  const guild = client.guilds.cache.get(GUILD_ID);
  if (!guild) return res.status(503).json({ error: 'Guild not cached yet.' });

  const list = guild.channels.cache
    .filter(c => c.type === 0 || c.type === 2) // text + voice only
    .sort((a, b) => a.position - b.position)
    .map(c => ({
      id: c.id,
      name: c.name,
      type: c.type === 0 ? 'text' : 'voice',
      position: c.position,
    }));

  res.json(list);
});

app.listen(PORT, () => {
  console.log(`[API] listening on port ${PORT}`);
});

// ---------------------------------------------
// Bot lifecycle
// ---------------------------------------------
client.once('ready', async () => {
  console.log(`[BOT] logged in as ${client.user.tag}`);
  await refreshCache();
  // refresh every 60s so numbers stay current without hammering the API
  setInterval(refreshCache, 60_000);
});

// keep cache fresh on join/leave instead of waiting for the interval
client.on('guildMemberAdd', refreshCache);
client.on('guildMemberRemove', refreshCache);
client.on('channelCreate', refreshCache);
client.on('channelDelete', refreshCache);

// these were missing before — without them, connection failures fail silently
// and you just get a bot that never becomes ready with zero explanation why
client.on('error', (err) => {
  console.error('[client error]', err);
});
client.on('shardError', (err) => {
  console.error('[shard error]', err);
});
client.on('shardDisconnect', (event, id) => {
  console.error(`[shard ${id}] disconnected — code ${event.code}, reason: ${event.reason}`);
});

// warn loudly if it's been a while and we're still not ready — helps catch
// a hung connection instead of it just sitting there forever with no sign of life
setTimeout(() => {
  if (!client.isReady()) {
    console.error('[BOT] still not ready 30s after login attempt — connection to Discord may be stuck or failing silently.');
  }
}, 30_000);

client.login(BOT_TOKEN).catch((err) => {
  console.error('[BOT] login() rejected:', err.message);
  console.error(err);
});
