const { EmbedBuilder, PermissionFlagsBits: P } = require('discord.js');
const db = require('./db');
const config = require('../config');
const { isStaff, hierarchyProblem } = require('./perms');
const scope = (guildId) => db.data.cases.filter(c => c.guildId === guildId);
const active = (guildId, userId, type) => scope(guildId).filter(c => !c.removed && (!userId || c.userId === userId) && (!type || c.type === type));
const manager = i => i.member.permissions.has(P.Administrator) || i.guild.ownerId === i.user.id;
function authorize(i, permission, management = false) {
  if (!i.guild || !isStaff(i.member)) throw new Error('This tool is only available to server staff.');
  if (management && !manager(i)) throw new Error('Only server administrators can manage staff warnings or escalation settings.');
  if (permission && !i.member.permissions.has(permission)) throw new Error('You do not have the Discord permission required for this action.');
}
function card(title, description) {
  return new EmbedBuilder().setColor(0x5865F2).setTitle(title).setDescription(String(description || 'No records found.').slice(0, 4000))
    .setFooter({ text: `${config.name} • Staff tools • Keep records confidential` }).setTimestamp();
}
function payload(title, description, extra = {}) {
  return { embeds: [card(title, description)], allowedMentions: { parse: [] }, ...extra };
}
async function audit(i, record) {
  const id = config.channels.modLogs;
  if (!id) return;
  try {
    const channel = await i.guild.channels.fetch(id);
    if (channel?.isTextBased()) await channel.send(payload(`Case #${record.id} · ${record.type}`, `**Member:** <@${record.userId}>\n**Moderator:** <@${record.modId}>\n**Reason:** ${record.reason}\n**Points:** ${record.points || 0}`));
  } catch (e) { console.error('[moderation log delivery failed]', e.message); }
}
async function record(i, user, type, reason, extra = {}) {
  const c = { id: db.data.nextCaseId++, guildId: i.guildId, userId: user.id, modId: i.user.id, type, reason, at: Date.now(), points: type === 'warn' ? 1 : 0, ...extra };
  db.data.cases.push(c); db.save(); await audit(i, c); return c;
}
const permissions = { ban: P.BanMembers, unban: P.BanMembers, kick: P.KickMembers, timeout: P.ModerateMembers, untimeout: P.ModerateMembers };
async function punish(i, type, user, reason, minutes) {
  authorize(i, permissions[type]);
  if (user.id === i.user.id || user.id === i.client.user.id || user.id === i.guild.ownerId) throw new Error('You cannot target yourself, this bot, or the server owner.');
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  if (type !== 'ban' && type !== 'unban' && !member) throw new Error('That member is not in this server.');
  if (member) { const problem = hierarchyProblem(i.guild, i.member, member); if (problem) throw new Error(problem); }
  if (permissions[type] && !i.guild.members.me.permissions.has(permissions[type])) throw new Error('The bot is missing the required Discord permission.');
  const auditReason = `${i.user.id}: ${reason}`.slice(0, 512);
  if (type === 'ban') await i.guild.members.ban(user.id, { reason: auditReason });
  if (type === 'unban') await i.guild.members.unban(user.id, auditReason);
  if (type === 'kick') await member.kick(auditReason);
  if (type === 'timeout') await member.timeout(minutes * 60000, auditReason);
  if (type === 'untimeout') await member.timeout(null, auditReason);
  const c = await record(i, user, type, reason, { ...(minutes ? { minutes, expiresAt: Date.now() + minutes * 60000 } : {}) });
  const dmDelivered = await user.send(payload(`${config.name} · ${type}`, `**Case:** #${c.id}\n**Reason:** ${reason}${minutes ? `\n**Duration:** ${minutes} minutes` : ''}`)).then(() => true).catch(() => false);
  let escalation = '';
  if (type === 'warn') {
    const settings = db.data.escalation[i.guildId];
    const count = active(i.guildId, user.id, 'warn').length;
    if (settings?.enabled) {
      const action = settings.banAt && count === settings.banAt ? 'ban' : settings.timeoutAt && count === settings.timeoutAt ? 'timeout' : null;
      if (action) {
        try { await punish(i, action, user, `Automatic escalation: ${count} active warnings`, settings.timeoutMinutes); escalation = `\nEscalation: ${action} applied and recorded.`; }
        catch (e) { escalation = `\nWarning saved, but escalation failed: ${e.message}`; }
      }
    }
  }
  return `**${type}** recorded for <@${user.id}>.\n**Case:** #${c.id}\n**Reason:** ${reason}\n**DM:** ${dmDelivered ? 'Delivered' : 'Unavailable; action still recorded'}${escalation}`;
}
const lines = records => records.map(c => `**#${c.id} · ${c.type}** — <@${c.userId}>\n${c.removed ? '[Voided] ' : ''}${String(c.reason).slice(0, 180)} · <t:${Math.floor(c.at / 1000)}:d>`).join('\n\n');
module.exports = { scope, active, manager, authorize, card, payload, record, punish, lines, audit };
