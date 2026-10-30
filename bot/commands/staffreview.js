const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../config');
const db = require('../utils/db');
const ui = require('../utils/ui');
const { isStaff } = require('../utils/perms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('staffreview')
    .setDescription('Leave a review for a staff member who helped you')
    .addUserOption((o) => o.setName('staff').setDescription('The staff member').setRequired(true))
    .addIntegerOption((o) =>
      o.setName('rating').setDescription('Rating from 1 to 10').setRequired(true).setMinValue(1).setMaxValue(10),
    )
    .addStringOption((o) =>
      o.setName('reason').setDescription('Why this rating?').setRequired(true).setMaxLength(500),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const user = interaction.options.getUser('staff', true);
    const rating = interaction.options.getInteger('rating', true);
    const reason = interaction.options.getString('reason', true);

    if (user.id === interaction.user.id) return interaction.editReply('You cannot review yourself.');
    const member = await interaction.guild.members.fetch(user.id).catch(() => null);
    if (!member || !isStaff(member)) return interaction.editReply('That person is not a staff member.');

    const channel = config.channels.staffReviews
      ? await interaction.guild.channels.fetch(config.channels.staffReviews).catch(() => null)
      : interaction.channel;
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply('The staff review channel has not been set up yet. Staff: set `channels.staffReviews` in config.js.');
    }

    await channel.send({
      ...ui.asMessage(ui.staffReviewCard({ staffId: user.id, rating, reason, reviewerId: interaction.user.id })),
      allowedMentions: { parse: [] }, // show the names, but do not ping anyone
    });

    db.data.reviews.push({ staffId: user.id, reviewerId: interaction.user.id, rating, reason, at: Date.now() });
    db.save();

    return interaction.editReply('Thank you! Your review was posted.');
  },
};
