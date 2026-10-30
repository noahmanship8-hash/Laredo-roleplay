const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../config');
const db = require('../utils/db');
const ui = require('../utils/ui');
const { isStaff } = require('../utils/perms');

const COUNTED = ['warn', 'kick', 'timeout'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('info')
    .setDescription('Staff: look up a member or the server')
    .addSubcommand((s) =>
      s
        .setName('user')
        .setDescription('Details about a member')
        .addUserOption((o) => o.setName('user').setDescription('Member (defaults to you)')),
    )
    .addSubcommand((s) => s.setName('server').setDescription('Details about this server')),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    }
    const { guild } = interaction;

    if (interaction.options.getSubcommand() === 'server') {
      const owner = await guild.fetchOwner().catch(() => null);
      return interaction.reply(
        ui.asEphemeral(
          ui.logCard(guild.name, [
            `**Owner:** ${owner ? owner.user : 'unknown'}`,
            `**Members:** ${guild.memberCount}`,
            `**Channels:** ${guild.channels.cache.size}`,
            `**Roles:** ${guild.roles.cache.size}`,
            `**Created:** <t:${Math.floor(guild.createdTimestamp / 1000)}:D> (<t:${Math.floor(guild.createdTimestamp / 1000)}:R>)`,
          ]),
        ),
      );
    }

    const user = interaction.options.getUser('user') || interaction.user;
    const member = await guild.members.fetch(user.id).catch(() => null);
    const count = db.data.cases.filter((c) => c.guildId === guild.id && c.userId === user.id && COUNTED.includes(c.type) && !c.removed).length;
    const roles = member
      ? member.roles.cache
          .filter((r) => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
          .first(15)
          .map((r) => `${r}`)
          .join(' ') || 'none'
      : 'not in this server';

    return interaction.reply(
      ui.asEphemeral(
        ui.logCard(`${user.username}`, [
          `**Mention:** ${user}`,
          `**ID:** ${user.id}`,
          `**Account created:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>`,
          member ? `**Joined server:** <t:${Math.floor(member.joinedTimestamp / 1000)}:R>` : '**Joined server:** -',
          `**Moderations:** ${count}/${config.maxModerations}`,
          `**Roles:** ${roles}`,
        ]),
      ),
    );
  },
};
