const { make } = require('../utils/command-factory');
const m = require('../utils/moderation');
const db = require('../utils/db');
const community = require('../utils/community');
module.exports = make('selfrole', 'Choose optional roles approved by your administrators', b => {
  for (const action of ['allow', 'join', 'leave']) b.addSubcommand(s => s.setName(action).setDescription({ allow: 'Administrator: approve a safe optional role', join: 'Give yourself an approved optional role', leave: 'Remove one of your approved optional roles' }[action]).addRoleOption(o => o.setName('role').setDescription('Optional community role').setRequired(true)));
  b.addSubcommand(s => s.setName('disallow').setDescription('Administrator: stop offering a role (does not remove existing roles)').addStringOption(o => o.setName('role_id').setDescription('Role ID shown by /selfrole list').setRequired(true)));
  b.addSubcommand(s => s.setName('list').setDescription('Show available optional roles'));
}, async i => {
  await i.deferReply({ flags: 64 });
  try {
    const s = community.settings(i.guildId), sub = i.options.getSubcommand();
    if (['allow', 'disallow'].includes(sub)) {
      m.authorize(i, require('discord.js').PermissionFlagsBits.ManageRoles, true);
      if (sub === 'allow') {
        const role = i.options.getRole('role', true); community.checkRole(i.guild, role);
        if (!s.selfroles.includes(role.id)) {
          if (s.selfroles.length >= 20) throw new Error('Maximum 20 optional roles. Disallow one first.');
          s.selfroles.push(role.id);
        }
      } else s.selfroles = s.selfroles.filter(id => id !== i.options.getString('role_id', true));
      db.save(); return i.editReply(m.payload('Optional roles updated', 'Use /selfrole list to view the available choices. Existing member roles were not changed.'));
    }
    if (sub === 'list') {
      const roles = await Promise.all(s.selfroles.map(id => i.guild.roles.fetch(id).catch(() => null)));
      const available = roles.filter(role => !community.roleProblem(i.guild, role));
      return i.editReply(m.payload('Optional community roles', available.map(role => `<@&${role.id}> · \`${role.id}\``).join('\n') + '\n\nUse /selfrole join or /selfrole leave with a role. Only approved, safe roles are available.'));
    }
    const role = await i.guild.roles.fetch(i.options.getRole('role', true).id);
    if (!s.selfroles.includes(role.id)) throw new Error('That role is not on the optional-role list. Use /selfrole list.');
    community.checkRole(i.guild, role);
    const member = await i.guild.members.fetch(i.user.id);
    const v = db.data.verification[i.guildId];
    if (sub === 'join' && v?.enabled) {
      const pending = db.data.pendingVerification[`${i.guildId}:${i.user.id}`] || (v.unverifiedRoleId && member.roles.cache.has(v.unverifiedRoleId));
      if (pending || (v.verifiedRoleId && !member.roles.cache.has(v.verifiedRoleId))) throw new Error('Complete server verification before choosing optional roles.');
    }
    if (sub === 'join') await member.roles.add(role, 'Member chose approved optional role');
    else await member.roles.remove(role, 'Member left approved optional role');
    return i.editReply(m.payload('Your roles updated', `${sub === 'join' ? 'Added' : 'Removed'} <@&${role.id}>.`));
  } catch (e) { return i.editReply(m.payload('Optional role action not completed', e.message)); }
});
