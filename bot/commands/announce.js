const {
  SlashCommandBuilder,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require('discord.js');
const { isStaff } = require('../utils/perms');

// /announce opens a pop-up form (so you can type several lines). Submitting it is handled in handlers/interactions.js
module.exports = {
  data: new SlashCommandBuilder()
    .setName('announce')
    .setDescription('Staff: post a formatted announcement (pings the announcement role)')
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post it (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addBooleanOption((o) => o.setName('ping').setDescription('Ping the announcement role? (default: yes)')),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    }
    const channel = interaction.options.getChannel('channel') || interaction.channel;
    const ping = interaction.options.getBoolean('ping') ?? true;

    const modal = new ModalBuilder()
      .setCustomId(`announce:${channel.id}:${ping ? 1 : 0}`)
      .setTitle('New Announcement')
      .addComponents(
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('title')
            .setLabel('Title')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100),
        ),
        new ActionRowBuilder().addComponents(
          new TextInputBuilder()
            .setCustomId('body')
            .setLabel('Announcement (you can use several lines)')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(3500),
        ),
      );
    return interaction.showModal(modal);
  },
};
