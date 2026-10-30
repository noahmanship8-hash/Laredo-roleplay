const { PermissionFlagsBits: P, Events } = require('discord.js');
const db = require('./db');
const config = require('../config');
// Automated and self-service roles must never grant administrative/moderation capabilities.
const privileged = ['Administrator', 'ManageGuild', 'ManageRoles', 'ManageChannels', 'ManageMessages', 'KickMembers', 'BanMembers', 'ModerateMembers', 'ManageWebhooks', 'ManageThreads', 'ManageEvents', 'CreateEvents', 'ManageGuildExpressions', 'ViewAuditLog', 'MentionEveryone', 'MuteMembers', 'DeafenMembers', 'MoveMembers', 'ManageNicknames'];
function settings(guildId) {
  return (db.data.community ||= {})[guildId] ||= { autoroleEnabled: true, autoroles: [], selfroles: [] };
}
function roleProblem(guild, role) {
  if (!role) return 'That role no longer exists.';
  if (role.managed || role.id === guild.id) return 'Managed roles and @everyone cannot be used.';
  const verification = db.data.verification[guild.id];
  const support = db.data.ticketSettings[guild.id]?.supportRoleId;
  const ticketRoles = Object.values(db.data.ticketCategoryRoles[guild.id] || {}).flat();
  if ([config.roles.staff, support, verification?.verifiedRoleId, verification?.unverifiedRoleId, ...ticketRoles].includes(role.id)) return 'Staff, ticket-support and verification roles cannot be automated or self-assigned.';
  if (privileged.some(name => P[name] && role.permissions.has(P[name]))) return 'That role grants privileged permissions and cannot be automated or self-assigned.';
  const me = guild.members.me;
  if (!me?.permissions.has(P.ManageRoles)) return 'The bot needs Manage Roles.';
  if (role.position >= me.roles.highest.position) return 'Move the bot role above this role first.';
  return null;
}
function checkRole(guild, role) {
  const problem = roleProblem(guild, role);
  if (problem) throw new Error(problem);
}
async function assignAutoRoles(member, stage = 'join') {
  const s = settings(member.guild.id);
  if (!s.autoroleEnabled) return [];
  const verificationEnabled = db.data.verification[member.guild.id]?.enabled;
  // Defer human join roles too: they may allow channel access that bypasses verification.
  if (!member.user.bot && stage === 'join' && verificationEnabled) return [];
  const applicable = s.autoroles.filter(rule => {
    if (rule.target === 'bots' ? !member.user.bot : member.user.bot) return false;
    if (stage === 'verified') return !member.user.bot && (rule.stage === 'verified' || rule.stage === 'join');
    return rule.stage === 'join';
  });
  const outcomes = [];
  for (const rule of applicable) {
    if (member.roles.cache.has(rule.roleId)) continue;
    try {
      const role = await member.guild.roles.fetch(rule.roleId);
      checkRole(member.guild, role);
      await member.roles.add(role, `Automatic role: ${stage}`);
      outcomes.push({ roleId: rule.roleId, ok: true });
    } catch (error) {
      console.error(`[autorole ${member.guild.id}/${rule.roleId}]`, error.message);
      outcomes.push({ roleId: rule.roleId, ok: false });
    }
  }
  return outcomes;
}
function install(client) {
  client.on(Events.GuildMemberAdd, member => assignAutoRoles(member).catch(error => console.error('[autorole]', error.message)));
}
module.exports = { settings, roleProblem, checkRole, assignAutoRoles, install };
