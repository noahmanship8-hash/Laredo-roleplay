const { PermissionFlagsBits } = require('discord.js');
const config = require('../config');
const db = require('./db');

// True if the member has the staff role (config.roles.staff) or the Administrator permission.
function isStaff(member) {
  if (!member) return false;
  if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
  return Boolean(config.roles.staff && member.roles.cache.has(config.roles.staff));
}

function isTicketStaff(member, ticket) {
  if (isStaff(member)) return true;
  if (!member || !ticket) return false;
  const settings = db.data.ticketSettings[member.guild.id] || {};
  const categoryRoles = db.data.ticketCategoryRoles[member.guild.id]?.[ticket.type] || [];
  return [settings.supportRoleId, ...categoryRoles].some(id => id && member.roles.cache.has(id));
}

// Can `moderator` act on `target`? (role hierarchy: nobody can touch someone equal/higher)
// Returns null if OK, or a string explaining why not.
function hierarchyProblem(guild, moderator, target) {
  if (target.id === guild.ownerId) return 'You cannot do that to the server owner.';
  if (target.id === moderator.id) return 'You cannot do that to yourself.';
  if (moderator.id !== guild.ownerId && target.roles.highest.position >= moderator.roles.highest.position) {
    return 'That member has the same or a higher role than you.';
  }
  const me = guild.members.me;
  if (me && target.roles.highest.position >= me.roles.highest.position) {
    return "That member's highest role is above mine. Move my bot role higher in Server Settings -> Roles.";
  }
  return null;
}

module.exports = { isStaff, isTicketStaff, hierarchyProblem };
