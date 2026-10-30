const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('../utils/perms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('role')
    .setDescription('Staff: give or remove a role')
    .addSubcommand((s) =>
      s
        .setName('add')
        .setDescription('Give a member a role')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role to give').setRequired(true)),
    )
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Take a role from a member')
        .addUserOption((o) => o.setName('user').setDescription('Member').setRequired(true))
        .addRoleOption((o) => o.setName('role').setDescription('Role to remove').setRequired(true)),
    ),

  async execute(interaction) {
    const reply = (content) => interaction.deferred ? interaction.editReply(require('../utils/moderation').payload('Role management', content)) : interaction.reply({ ...require('../utils/moderation').payload('Role management', content), flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction.member) || !interaction.member.permissions.has(PermissionFlagsBits.ManageRoles)) return reply('Staff with Manage Roles permission only.');
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const { guild, member: mod } = interaction;
    const role = interaction.options.getRole('role', true);
    const user = interaction.options.getUser('user', true);
    const target = await guild.members.fetch(user.id).catch(() => null);
    if (!target) return reply('That user is not in this server.');
    const problem = require('../utils/perms').hierarchyProblem(guild, mod, target);
    if (problem) return reply(problem);
    const privileged = [PermissionFlagsBits.Administrator, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.ManageGuild, PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers];
    if (role.permissions.any(privileged) && !mod.permissions.has(PermissionFlagsBits.Administrator)) return reply('Only administrators can manage privileged roles.');

    if (role.managed || role.id === guild.id) return reply('That role cannot be given or removed manually.');
    if (mod.id !== guild.ownerId && role.position >= mod.roles.highest.position) {
      return reply('You can only manage roles that are below your highest role.');
    }
    if (role.position >= guild.members.me.roles.highest.position) {
      return reply('That role is above my highest role. Move my bot role higher in Server Settings -> Roles.');
    }

    try {
      if (interaction.options.getSubcommand() === 'add') {
        await target.roles.add(role, `Added by ${mod.user.username}`);
        return reply(`Gave ${role} to ${target}.`);
      }
      await target.roles.remove(role, `Removed by ${mod.user.username}`);
      return reply(`Removed ${role} from ${target}.`);
    } catch (err) {
      console.error(err);
      return reply('I could not change that role. Check that I have the Manage Roles permission.');
    }
  },
};
