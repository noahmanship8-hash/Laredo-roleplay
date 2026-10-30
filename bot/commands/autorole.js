const { PermissionFlagsBits: P } = require('discord.js');
const { make } = require('../utils/command-factory');
const m = require('../utils/moderation');
const db = require('../utils/db');
const community = require('../utils/community');
module.exports = make('autorole', 'Configure safe automatic member and bot roles', b => {
  b.setDefaultMemberPermissions(P.Administrator);
  b.addSubcommand(s => s.setName('add').setDescription('Automatically grant a safe role to future joins or verified members')
    .addRoleOption(o => o.setName('role').setDescription('Non-staff role below the bot').setRequired(true))
    .addStringOption(o => o.setName('target').setDescription('Who receives this role').setRequired(true).addChoices({ name: 'Human members', value: 'humans' }, { name: 'Bots', value: 'bots' }))
    .addStringOption(o => o.setName('stage').setDescription('Default: join; human join roles wait for verification when enabled').addChoices({ name: 'On join', value: 'join' }, { name: 'After verification', value: 'verified' })));
  b.addSubcommand(s => s.setName('remove').setDescription('Stop automatically granting a role; existing members keep it')
    .addStringOption(o => o.setName('role_id').setDescription('Role ID shown by /autorole list (also works for deleted roles)').setRequired(true)));
  b.addSubcommand(s => s.setName('list').setDescription('Show automatic roles and safety checks'));
  b.addSubcommand(s => s.setName('toggle').setDescription('Pause or resume automatic role assignments')
    .addBooleanOption(o => o.setName('enabled').setDescription('Enable auto-roles').setRequired(true)));
}, async i => {
  await i.deferReply({ flags: 64 });
  try {
    m.authorize(i, P.ManageRoles, true);
    const s = community.settings(i.guildId), sub = i.options.getSubcommand();
    if (sub === 'add') {
      const role = i.options.getRole('role', true);
      const target = i.options.getString('target', true), stage = i.options.getString('stage') || 'join';
      community.checkRole(i.guild, role);
      if (target === 'bots' && stage === 'verified') throw new Error('Bots cannot complete verification. Use the join stage for bot roles.');
      const existing = s.autoroles.find(r => r.roleId === role.id && r.target === target);
      if (!existing && s.autoroles.length >= 20) throw new Error('Maximum 20 auto-role rules. Remove a rule first.');
      if (existing) existing.stage = stage;
      else s.autoroles.push({ roleId: role.id, target, stage });
      db.save();
      return i.editReply(m.payload('Auto-role saved', `<@&${role.id}> → **${target}**, stage **${stage}**.\n${s.autoroleEnabled ? '' : 'Auto-roles are paused. Use /autorole toggle to enable them.\n'}Only future joins/verification are affected. Human join roles wait until verification while verification is enabled. No existing members were changed.`));
    }
    if (sub === 'remove') {
      const id = i.options.getString('role_id', true);
      const before = s.autoroles.length; s.autoroles = s.autoroles.filter(r => r.roleId !== id); db.save();
      return i.editReply(m.payload('Auto-role removed', `Removed ${before - s.autoroles.length} rule(s). Existing member roles were not removed.`));
    }
    if (sub === 'toggle') {
      s.autoroleEnabled = i.options.getBoolean('enabled'); db.save();
      return i.editReply(m.payload('Auto-roles updated', s.autoroleEnabled ? 'Auto-roles enabled for future joins and verification.' : 'Auto-roles paused. Existing roles stay unchanged.'));
    }
    const lines = await Promise.all(s.autoroles.map(async r => {
      const role = await i.guild.roles.fetch(r.roleId).catch(() => null);
      const problem = community.roleProblem(i.guild, role);
      return `<@&${r.roleId}> · \`${r.roleId}\` · ${r.target} · ${r.stage}${problem ? `\n⚠ ${problem}` : ''}`;
    }));
    return i.editReply(m.payload('Automatic roles', `**Status:** ${s.autoroleEnabled ? 'Enabled' : 'Paused'}\n\n${lines.join('\n\n') || 'No rules. Use /autorole add.'}\n\nWith verification enabled, human join roles are granted only after successful verification. Verified-only rules require verification to be enabled.`));
  } catch (e) { return i.editReply(m.payload('Auto-role action not completed', e.message)); }
});
