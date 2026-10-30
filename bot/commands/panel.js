const { SlashCommandBuilder, ChannelType, MessageFlags } = require('discord.js');
const config = require('../config');
const ui = require('../utils/ui');
const db = require('../utils/db');
const { isStaff } = require('../utils/perms');

const builders = {
  regulations: () => ui.regulationsPanel(),
  information: () => ui.informationPanel(),
  assistance: () => ui.assistancePanel(),
  notifications: () => ui.notificationsPanel(),
  departments: () => ui.departmentsPanel(),
  applications: () => ui.applicationsPanel(),
  marketplace: () => ui.marketplacePanel(),
  session: () => ui.sessionPanel(db.data.session),
  staffInfo: () => ui.staffInfoPanel(),
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('panel')
    .setDescription('Staff: post one of the server panels in a channel')
    .addStringOption((o) =>
      o
        .setName('type')
        .setDescription('Which panel to post')
        .setRequired(true)
        .addChoices(
          { name: 'Regulations', value: 'regulations' },
          { name: 'Information', value: 'information' },
          { name: 'Assistance (tickets)', value: 'assistance' },
          { name: 'Session Info', value: 'session' },
          { name: 'Notifications (roles)', value: 'notifications' },
          { name: 'Departments', value: 'departments' },
          { name: 'Applications', value: 'applications' },
          { name: 'Marketplace (shop)', value: 'marketplace' },
          { name: 'Staff Info', value: 'staffInfo' }
        ),
    )
    .addChannelOption((o) =>
      o
        .setName('channel')
        .setDescription('Where to post it (defaults to this channel)')
        .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement),
    )
    .addBooleanOption((o) =>
      o.setName('ping').setDescription('Applications panel only: ping the announcement role (default: yes)'),
    ),

  async execute(interaction) {
    if (!isStaff(interaction.member)) {
      return interaction.reply({ content: 'Staff only.', flags: MessageFlags.Ephemeral });
    }
    const type = interaction.options.getString('type', true);
    const channel = interaction.options.getChannel('channel') || interaction.channel;

    let pinged = false;
    const roleId = config.roles.announcementPing;
    if (type === 'applications' && roleId && (interaction.options.getBoolean('ping') ?? true)) {
      await channel.send({ content: `<@&${roleId}>`, allowedMentions: { roles: [roleId] } });
      pinged = true;
    }

    const sent = await channel.send(ui.asMessage(builders[type]()));

    if (type === 'session') {
      db.data.session.channelId = channel.id;
      db.data.session.messageId = sent.id;
      db.save();
    }
    return interaction.reply({
      content: `Posted the **${type}** panel in ${channel}${pinged ? ' and pinged the announcement role' : ''}.`,
      flags: MessageFlags.Ephemeral,
    });
  },
};
