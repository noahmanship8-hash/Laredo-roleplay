const { Events, EmbedBuilder, AuditLogEvent } = require('discord.js');
const db = require('./db');
const config = require('../config');
const categories = ['messages', 'voice', 'channels', 'roles', 'members', 'server', 'audit'];
const colors = { create: 0x57F287, delete: 0xED4245, update: 0xFEE75C, move: 0x5865F2 };
const clip = (value, max = 900) => String(value ?? 'Not available').slice(0, max) || '(empty)';
const field = (name, value, inline = false) => ({ name, value: clip(value, 600), inline });
const who = user => user ? `<@${user.id}> (${user.id})` : 'Unknown user';
const location = channel => channel ? `<#${channel.id}> · ${channel.name || channel.id}` : 'Not available';
function settings(guildId) { return db.data.logging?.[guildId] || {}; }
function isLogChannel(guildId, channelId) { return Object.values(settings(guildId)).includes(channelId); }
async function send(guild, category, action, title, description, fields = [], user, ids = '') {
  const channelId = settings(guild?.id)[category];
  if (!guild || !channelId) return;
  const channel = await guild.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return;
  const embed = new EmbedBuilder().setColor(colors[action] || colors.update).setTitle(clip(title, 256))
    .setDescription(clip(description, 1000)).setTimestamp()
    .setFooter({ text: clip(`${config.name} • ${category}${ids ? ` • ${ids}` : ''}`, 300) });
  if (fields.length) embed.addFields(fields.slice(0, 6));
  if (user) embed.setAuthor({ name: clip(user.tag || user.username || user.id, 256), ...(user.displayAvatarURL ? { iconURL: user.displayAvatarURL() } : {}) });
  await channel.send({ embeds: [embed], allowedMentions: { parse: [] } });
}
function changes(before, after, keys) {
  return keys.filter(key => before[key] !== after[key]).map(key => field(key, `Before: ${clip(before[key], 350)}\nAfter: ${clip(after[key], 350)}`));
}
function overwriteSummary(channel) {
  return [...(channel.permissionOverwrites?.cache?.values() || [])].sort((a,b) => a.id.localeCompare(b.id)).map(o => `${o.id}: allow=${o.allow.bitfield}, deny=${o.deny.bitfield}`).join('\n');
}
function roleFields(role) {
  return [field('Role', `<@&${role.id}> · ${role.name}`), field('Colour', role.hexColor, true), field('Position', role.position, true), field('Permission bitfield', role.permissions.bitfield.toString())];
}
function install(client) {
  // Event handlers must not throw into the gateway. Errors are logged without breaking other bot features.
  const on = (event, handler) => client.on(event, (...args) => Promise.resolve().then(() => handler(...args)).catch(error => console.error(`[server logs: ${event}]`, error.message)));
  on(Events.MessageDelete, message => {
    if (!message.guild || message.author?.bot || isLogChannel(message.guild.id, message.channelId)) return;
    return send(message.guild, 'messages', 'delete', 'Message deleted', `Message from ${who(message.author)} deleted in <#${message.channelId}>.`, [field('Message content', message.content || 'Not cached or unavailable. Deleted content cannot be recovered.'), ...(message.attachments?.size ? [field('Attachments', [...message.attachments.values()].map(a => a.url).join('\n'))] : [])], message.author, `User ID: ${message.author?.id || 'unknown'} • Message ID: ${message.id}`);
  });
  on(Events.MessageBulkDelete, (messages, channel) => {
    if (!channel.guild || isLogChannel(channel.guild.id, channel.id)) return;
    return send(channel.guild, 'messages', 'delete', 'Messages bulk deleted', `**${messages.size}** messages deleted in ${location(channel)}.`, [field('Cached sample (up to 5)', [...messages.values()].slice(0, 5).map(m => `${m.id} · ${m.author?.tag || 'Unknown'}: ${clip(m.content || 'Content not cached', 120)}`).join('\n'))]);
  });
  on(Events.MessageUpdate, (before, after) => {
    if (!after.guild || after.author?.bot || isLogChannel(after.guild.id, after.channelId)) return;
    if (before.content === after.content) return;
    return send(after.guild, 'messages', 'update', 'Message edited', `${who(after.author)} edited a message in <#${after.channelId}>.`, [field('Before', before.partial ? 'Not cached' : before.content), field('After', after.content || 'Content unavailable'), field('Jump to message', after.url)], after.author, `Message ID: ${after.id}`);
  });
  on(Events.VoiceStateUpdate, (before, after) => {
    const user = after.member?.user || before.member?.user;
    if (before.channelId !== after.channelId) {
      const action = !before.channelId ? 'create' : !after.channelId ? 'delete' : 'move';
      const title = !before.channelId ? 'Voice channel joined' : !after.channelId ? 'Voice channel left' : 'Voice channel moved';
      return send(after.guild, 'voice', action, title, `${who(user)} ${title.toLowerCase()}.`, [field('From', location(before.channel), true), field('To', location(after.channel), true), field('Member count', (after.channel || before.channel)?.members?.size ?? 'Unknown', true)], user, `User ID: ${after.id}`);
    }
    const fields = changes(before, after, ['serverMute', 'serverDeaf', 'selfMute', 'selfDeaf', 'streaming', 'selfVideo', 'suppress']);
    if (fields.length) return send(after.guild, 'voice', 'update', 'Voice state changed', `${who(user)} in ${location(after.channel)}`, fields, user, `User ID: ${after.id}`);
  });
  on(Events.ChannelCreate, channel => channel.guild && send(channel.guild, 'channels', 'create', 'Channel created', location(channel), [field('Type', channel.type), field('Category', channel.parentId || 'None')], null, `Channel ID: ${channel.id}`));
  on(Events.ChannelDelete, channel => channel.guild && send(channel.guild, 'channels', 'delete', 'Channel deleted', `**${channel.name}**`, [field('Type', channel.type)], null, `Channel ID: ${channel.id}`));
  on(Events.ChannelUpdate, (before, after) => {
    if (!after.guild) return;
    const fields = changes(before, after, ['name', 'type', 'parentId', 'rawPosition', 'topic', 'nsfw', 'rateLimitPerUser', 'bitrate', 'userLimit', 'rtcRegion']);
    const oldPerms = overwriteSummary(before), newPerms = overwriteSummary(after);
    if (oldPerms !== newPerms) fields.push(field('Permission overwrites changed', `Before: ${clip(oldPerms, 400)}\nAfter: ${clip(newPerms, 400)}`));
    if (fields.length) return send(after.guild, 'channels', 'update', 'Channel updated', location(after), fields, null, `Channel ID: ${after.id}`);
  });
  on(Events.ThreadCreate, (thread, newlyCreated) => newlyCreated && send(thread.guild, 'channels', 'create', 'Thread created', location(thread), [field('Parent channel', thread.parentId || 'None')], null, `Thread ID: ${thread.id}`));
  on(Events.ThreadDelete, thread => send(thread.guild, 'channels', 'delete', 'Thread deleted', thread.name, [], null, `Thread ID: ${thread.id}`));
  on(Events.ThreadUpdate, (before, after) => {
    const fields = changes(before, after, ['name', 'archived', 'locked', 'autoArchiveDuration', 'rateLimitPerUser']);
    if (fields.length) return send(after.guild, 'channels', 'update', 'Thread updated', location(after), fields, null, `Thread ID: ${after.id}`);
  });
  on(Events.GuildRoleCreate, role => send(role.guild, 'roles', 'create', 'Role created', `**${role.name}**`, roleFields(role), null, `Role ID: ${role.id}`));
  on(Events.GuildRoleDelete, role => send(role.guild, 'roles', 'delete', 'Role deleted', `**${role.name}**`, roleFields(role), null, `Role ID: ${role.id}`));
  on(Events.GuildRoleUpdate, (before, after) => {
    const fields = changes(before, after, ['name', 'hexColor', 'position', 'hoist', 'mentionable', 'unicodeEmoji', 'icon']);
    if (before.permissions.bitfield !== after.permissions.bitfield) fields.push(field('Permissions', `Before: ${before.permissions.bitfield}\nAfter: ${after.permissions.bitfield}`));
    if (fields.length) return send(after.guild, 'roles', 'update', 'Role updated', `<@&${after.id}>`, fields, null, `Role ID: ${after.id}`);
  });
  on(Events.GuildMemberAdd, member => send(member.guild, 'members', 'create', 'Member joined', who(member.user), [field('Member count', member.guild.memberCount)], member.user, `User ID: ${member.id}`));
  on(Events.GuildMemberRemove, member => send(member.guild, 'members', 'delete', 'Member left', `${who(member.user)} is no longer in the server. Check audit logs for any kick or ban.`, [], member.user, `User ID: ${member.id}`));
  on(Events.GuildMemberUpdate, (before, after) => {
    const fields = changes(before, after, ['nickname', 'communicationDisabledUntilTimestamp', 'pending']);
    const added = [...after.roles.cache.keys()].filter(id => !before.roles.cache.has(id));
    const removed = [...before.roles.cache.keys()].filter(id => !after.roles.cache.has(id));
    if (added.length) fields.push(field('Roles added', added.map(id => `<@&${id}>`).join(', ')));
    if (removed.length) fields.push(field('Roles removed', removed.map(id => `<@&${id}>`).join(', ')));
    if (fields.length) return send(after.guild, 'members', 'update', 'Member updated', who(after.user), fields, after.user, `User ID: ${after.id}`);
  });
  on(Events.GuildUpdate, (before, after) => {
    const fields = changes(before, after, ['name', 'description', 'icon', 'banner', 'ownerId', 'verificationLevel', 'explicitContentFilter', 'afkChannelId', 'afkTimeout', 'systemChannelId', 'preferredLocale']);
    if (fields.length) return send(after, 'server', 'update', 'Server settings changed', after.name, fields);
  });
  on(Events.GuildBanAdd, ban => send(ban.guild, 'members', 'delete', 'Member banned', who(ban.user), [field('Reason', ban.reason || 'Not provided; check audit logs')], ban.user));
  on(Events.GuildBanRemove, ban => send(ban.guild, 'members', 'create', 'Member unbanned', who(ban.user), [], ban.user));
  on(Events.GuildAuditLogEntryCreate, (entry, guild) => {
    const action = AuditLogEvent[entry.action] || String(entry.action);
    const color = /Delete|Kick|BanAdd|Prune/.test(action) ? 'delete' : /Create|BanRemove/.test(action) ? 'create' : 'update';
    return send(guild, 'audit', color, `Audit · ${action}`, `**Performed by:** ${entry.executorId ? `<@${entry.executorId}> (${entry.executorId})` : 'Unknown / unavailable'}`, [field('Target ID', entry.targetId), field('Reason', entry.reason || 'Not provided'), field('Changes (up to 8)', (entry.changes || []).slice(0,8).map(c => `${c.key}: ${clip(JSON.stringify(c.old), 70)} → ${clip(JSON.stringify(c.new), 70)}`).join('\n'))], null, `Audit ID: ${entry.id}`);
  });
}
module.exports = { install, send, categories, colors, settings };
