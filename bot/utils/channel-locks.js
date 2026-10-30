const db = require('./db');
const { PermissionFlagsBits: P } = require('discord.js');
async function restore(guild, entry) {
  const ch = await guild.channels.fetch(entry.channelId);
  await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: entry.before }, { reason: 'Restore channel lock overwrite' });
  delete db.data.locks[`${guild.id}:${entry.channelId}`]; db.save();
}
function start(client) {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return; running = true;
    try {
      for (const entry of Object.values(db.data.locks)) {
        if (!entry.expiresAt || entry.expiresAt > Date.now()) continue;
        try { await restore(await client.guilds.fetch(entry.guildId), entry); }
        catch (e) { console.error('[temporary unlock failed; will retry]', e.message); }
      }
    } finally { running = false; }
  }, 15000);
  timer.unref();
}
module.exports = { restore, start, P };
