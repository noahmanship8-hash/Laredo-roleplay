// Reads the latest posts from your Discord announcements channel and saves them to announcements.json.
// It runs on GitHub Actions (see .github/workflows/update-announcements.yml). Needs Node 18 or newer, no packages.
//
// Required environment variables (stored as GitHub "secrets", never in a file):
//   DISCORD_BOT_TOKEN          the bot token from the Discord Developer Portal
//   ANNOUNCEMENTS_CHANNEL_ID   the ID of your announcements channel
// Optional:
//   ANNOUNCEMENT_LIMIT         how many posts to keep (default 15, max 50)

import { readFile, writeFile } from 'node:fs/promises';

const API = process.env.DISCORD_API_BASE || 'https://discord.com/api/v10';
const TOKEN = (process.env.DISCORD_BOT_TOKEN || '').trim();
const CHANNEL = (process.env.ANNOUNCEMENTS_CHANNEL_ID || '').trim();
const LIMIT = Math.max(1, Math.min(Number(process.env.ANNOUNCEMENT_LIMIT) || 15, 50));
const OUT = new URL('../announcements.json', import.meta.url);

if (!TOKEN || !CHANNEL) {
  console.error('Missing DISCORD_BOT_TOKEN or ANNOUNCEMENTS_CHANNEL_ID. Add both as GitHub secrets (see README.md).');
  process.exit(1);
}

const HELP = {
  401: 'Discord rejected the bot token. Reset the token in the Developer Portal and update the DISCORD_BOT_TOKEN secret.',
  403: 'The bot cannot see that channel. Invite the bot to your server and give it View Channel and Read Message History on the announcements channel.',
  404: 'Channel not found. Check ANNOUNCEMENTS_CHANNEL_ID, and make sure the bot is in the same server.'
};

async function api(path, attempt = 0) {
  const res = await fetch(API + path, {
    headers: {
      Authorization: 'Bot ' + TOKEN,
      'User-Agent': 'LaredoRoleplayAnnouncements (https://discord.gg/dqpUcfUvrt, 1.0)'
    }
  });
  if (res.status === 429 && attempt < 2) {
    const body = await res.json().catch(() => ({}));
    const wait = Math.min(Number(body.retry_after) || 2, 15);
    await new Promise((resolve) => setTimeout(resolve, wait * 1000));
    return api(path, attempt + 1);
  }
  if (!res.ok) {
    throw new Error(`Discord API error ${res.status} for ${path.split('?')[0]}. ${HELP[res.status] || ''}`.trim());
  }
  return res.json();
}

function avatarUrl(user) {
  if (user.avatar) return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
  const index = Number((BigInt(user.id) >> 22n) % 6n);
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

async function main() {
  const channel = await api(`/channels/${CHANNEL}`);
  const guildId = channel.guild_id;

  // Used to turn mentions like <@&123> into readable names. Optional: failures are ignored.
  let roles = [];
  let channels = [];
  try { roles = await api(`/guilds/${guildId}/roles`); } catch { /* ignore */ }
  try { channels = await api(`/guilds/${guildId}/channels`); } catch { /* ignore */ }
  const roleNames = new Map(roles.map((r) => [r.id, r.name]));
  const channelNames = new Map(channels.map((c) => [c.id, c.name]));

  function resolve(text, message) {
    return String(text || '')
      .replace(/<@&(\d+)>/g, (_, id) => '@' + (roleNames.get(id) || 'role'))
      .replace(/<@!?(\d+)>/g, (_, id) => {
        const user = (message.mentions || []).find((u) => u.id === id);
        return '@' + (user ? user.global_name || user.username : 'user');
      })
      .replace(/<#(\d+)>/g, (_, id) => '#' + (channelNames.get(id) || 'channel'))
      .replace(/<t:(\d+)(?::[a-zA-Z])?>/g, (_, secs) => new Date(Number(secs) * 1000).toUTCString());
  }

  // Discord's newer Components V2 messages can look like embeds in Discord,
  // but their content is returned in `components`, not `embeds`.
  function saveComponent(component, message) {
    if (!component || typeof component !== 'object') return null;
    const saved = { type: Number(component.type) };
    if (saved.type === 10) {
      saved.content = resolve(component.content, message);
    } else if (saved.type === 9 || saved.type === 17 || saved.type === 1) {
      saved.components = (component.components || []).map((child) => saveComponent(child, message)).filter(Boolean);
      if (component.accessory) saved.accessory = saveComponent(component.accessory, message);
      if (saved.type === 17 && Number.isInteger(component.accent_color)) saved.accentColor = component.accent_color;
    } else if (saved.type === 11) {
      saved.url = component.media && component.media.url;
      saved.description = resolve(component.description, message);
    } else if (saved.type === 12) {
      saved.items = (component.items || []).map((item) => ({
        url: item.media && item.media.url,
        description: resolve(item.description, message)
      }));
    } else if (saved.type === 14) {
      saved.divider = component.divider !== false;
    } else if (saved.type === 2) {
      saved.label = resolve(component.label, message);
      saved.url = component.url;
      saved.style = Number(component.style);
    } else if (saved.type === 13) {
      saved.name = resolve(component.name, message);
      saved.url = component.file && component.file.url;
    }
    return saved;
  }

  const messages = await api(`/channels/${CHANNEL}/messages?limit=${Math.min(LIMIT * 3, 100)}`);

  const announcements = messages
    // Keep messages with embeds even when they have no regular message text.
    .filter((m) => (m.content && m.content.trim()) || (m.embeds && m.embeds.length) || (m.components && m.components.length))
    .slice(0, LIMIT)
    .map((m) => ({
      id: m.id,
      timestamp: m.timestamp,
      edited: Boolean(m.edited_timestamp),
      author: { name: m.author.global_name || m.author.username, avatar: avatarUrl(m.author) },
      content: resolve(m.content, m),
      embeds: (m.embeds || [])
        .filter((e) => e.title || e.description || (e.fields && e.fields.length) || e.image || e.thumbnail || e.author || e.footer)
        .map((e) => ({
          title: resolve(e.title, m),
          description: resolve(e.description, m),
          url: e.url,
          color: e.color,
          author: e.author && { name: resolve(e.author.name, m), url: e.author.url, iconUrl: e.author.icon_url },
          fields: (e.fields || []).map((f) => ({ name: resolve(f.name, m), value: resolve(f.value, m), inline: Boolean(f.inline) })),
          image: e.image && e.image.url,
          thumbnail: e.thumbnail && e.thumbnail.url,
          footer: e.footer && { text: resolve(e.footer.text, m), iconUrl: e.footer.icon_url },
          timestamp: e.timestamp
        })),
      components: (m.components || []).map((component) => saveComponent(component, m)).filter(Boolean),
      componentsV2: Boolean(Number(m.flags || 0) & 32768),
      attachments: (m.attachments || []).length,
      url: `https://discord.com/channels/${guildId}/${CHANNEL}/${m.id}`
    }));

  // Only rewrite the file when something changed, so the site is not redeployed for nothing.
  let previous = null;
  try { previous = JSON.parse(await readFile(OUT, 'utf8')); } catch { /* first run */ }
  if (previous && JSON.stringify(previous.announcements) === JSON.stringify(announcements)) {
    console.log(`No changes (${announcements.length} announcements).`);
    return;
  }

  const output = { updated: new Date().toISOString(), guildId, channelId: CHANNEL, announcements };
  await writeFile(OUT, JSON.stringify(output, null, 2) + '\n', 'utf8');
  console.log(`Saved ${announcements.length} announcements.`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
