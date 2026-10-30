const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { isStaff } = require('../utils/perms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('purge')
    .setDescription('Staff: delete recent messages in this channel')
    .addIntegerOption((o) =>
      o.setName('amount').setDescription('How many messages (1-100)').setRequired(true).setMinValue(1).setMaxValue(100),
    ),

  async execute(interaction) {
    if (!isStaff(interaction.member) || !interaction.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    }
    const amount = interaction.options.getInteger('amount', true);
    try {
      const deleted = await interaction.channel.bulkDelete(amount, true); // true = skip messages older than 14 days
      return interaction.reply({ content: `Deleted ${deleted.size} message(s).`, flags: MessageFlags.Ephemeral });
    } catch (err) {
      console.error(err);
      return interaction.reply({ content: 'I could not delete messages here. Check my Manage Messages permission.', flags: MessageFlags.Ephemeral });
    }
  },
};
