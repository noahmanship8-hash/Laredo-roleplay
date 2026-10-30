const { SlashCommandBuilder } = require('discord.js');

const reasonOption = (o) => o.setName('reason').setDescription('Why?').setRequired(true).setMaxLength(500);
const userOption = (o) => o.setName('user').setDescription('Member').setRequired(true);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('mod')
    .setDescription('Staff: moderation tools')
    .addSubcommand((s) =>
      s.setName('warn').setDescription('Warn a member').addUserOption(userOption).addStringOption(reasonOption),
    )
    .addSubcommand((s) =>
      s.setName('kick').setDescription('Kick a member').addUserOption(userOption).addStringOption(reasonOption),
    )
    .addSubcommand((s) =>
      s.setName('ban').setDescription('Ban a user').addUserOption(userOption).addStringOption(reasonOption),
    )
    .addSubcommand((s) =>
      s
        .setName('timeout')
        .setDescription('Timeout (mute) a member')
        .addUserOption(userOption)
        .addIntegerOption((o) =>
          o.setName('minutes').setDescription('How long, in minutes (max 40320 = 28 days)').setRequired(true).setMinValue(1).setMaxValue(40320),
        )
        .addStringOption(reasonOption),
    )
    .addSubcommand((s) => s.setName('history').setDescription("Show a member's moderation history").addUserOption(userOption))
    .addSubcommand((s) => s.setName('warnings').setDescription("Show a member's warnings").addUserOption(userOption))
    .addSubcommand((s) => s.setName('clearwarnings').setDescription("Clear a member's warnings").addUserOption(userOption))
    .addSubcommand((s) => s.setName('untimeout').setDescription('Remove a member timeout').addUserOption(userOption).addStringOption((o) => o.setName('reason').setDescription('Why?').setMaxLength(500)))
    .addSubcommand((s) => s.setName('unban').setDescription('Unban a user by ID').addStringOption((o) => o.setName('user_id').setDescription('Discord user ID').setRequired(true)).addStringOption((o) => o.setName('reason').setDescription('Why?').setMaxLength(500)))
    .addSubcommand((s) =>
      s
        .setName('remove')
        .setDescription('Remove a case so it no longer counts')
        .addIntegerOption((o) => o.setName('case').setDescription('Case number').setRequired(true).setMinValue(1)),
    )
    .addSubcommandGroup((g) => g.setName('escalation').setDescription('Configure automatic punishment escalation')
      .addSubcommand(s => s.setName('settings').setDescription('Show escalation settings'))
      .addSubcommand(s => s.setName('toggle').setDescription('Enable or disable escalation').addBooleanOption(o => o.setName('enabled').setDescription('Enabled').setRequired(true)))
      .addSubcommand(s => s.setName('settimeout').setDescription('Set warning count for automatic timeout').addIntegerOption(o => o.setName('warnings').setDescription('Warning count').setRequired(true).setMinValue(1).setMaxValue(100)).addIntegerOption(o => o.setName('minutes').setDescription('Timeout minutes').setRequired(true).setMinValue(1).setMaxValue(40320)))
      .addSubcommand(s => s.setName('setban').setDescription('Set warning count for automatic ban').addIntegerOption(o => o.setName('warnings').setDescription('Warning count').setRequired(true).setMinValue(1).setMaxValue(100)))),

  execute: require('../utils/mod-command').execute,
};
