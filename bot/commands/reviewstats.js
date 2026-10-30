const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../config');
const db = require('../utils/db');
const { isStaff } = require('../utils/perms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('reviewstats')
    .setDescription('Staff: see the average review rating for a staff member')
    .addUserOption((o) => o.setName('staff').setDescription('The staff member').setRequired(true)),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    }
    const user = interaction.options.getUser('staff', true);
    const list = db.data.reviews.filter((r) => r.staffId === user.id);
    if (!list.length) {
      return interaction.reply({ content: `${user.username} has no reviews yet.`, flags: MessageFlags.Ephemeral });
    }
    const avg = list.reduce((sum, r) => sum + r.rating, 0) / list.length;
    return interaction.reply({
      content: `**${user.username}** has **${list.length}** review(s) with an average rating of **${avg.toFixed(1)}/10**.`,
      flags: MessageFlags.Ephemeral,
      allowedMentions: { parse: [] },
    });
  },
};
