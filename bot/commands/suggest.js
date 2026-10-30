const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const config = require('../config');
const db = require('../utils/db');
const ui = require('../utils/ui');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('suggest')
    .setDescription('Suggest something for the server')
    .addStringOption((o) =>
      o.setName('suggestion').setDescription('What is your suggestion?').setRequired(true).setMaxLength(1000),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = config.channels.suggestions
      ? await interaction.guild.channels.fetch(config.channels.suggestions).catch(() => null)
      : interaction.channel;
    if (!channel || !channel.isTextBased()) {
      return interaction.editReply('The suggestions channel has not been set up yet. Staff: set `channels.suggestions` in config.js.');
    }

    const s = {
      userId: interaction.user.id,
      text: interaction.options.getString('suggestion', true),
      up: [],
      down: [],
      status: 'pending',
      by: null,
    };

    const message = await channel.send(ui.asMessage(ui.suggestionCard(s)));
    db.data.suggestions[message.id] = s;
    db.save();

    // the "Discussion" thread under the suggestion
    await message.startThread({ name: 'Discussion', autoArchiveDuration: 1440 }).catch(() => {});

    return interaction.editReply(`Your suggestion was posted in ${channel}.`);
  },
};
