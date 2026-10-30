const { SlashCommandBuilder, MessageFlags } = require('discord.js');
const { isStaff } = require('../utils/perms');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('channel')
    .setDescription('Staff: channel tools for the channel you are in')
    .addSubcommand((s) => s.setName('lockdown').setDescription('Lock text channels across the server'))
    .addSubcommand((s) => s.setName('unlockdown').setDescription('Unlock text channels across the server'))
    .addSubcommand((s) => s.setName('lock').setDescription('Stop @everyone from sending messages here'))
    .addSubcommand((s) => s.setName('unlock').setDescription('Let @everyone send messages here again'))
    .addSubcommand((s) =>
      s
        .setName('slowmode')
        .setDescription('Set slowmode (0 turns it off)')
        .addIntegerOption((o) =>
          o.setName('seconds').setDescription('Seconds between messages (0-21600)').setRequired(true).setMinValue(0).setMaxValue(21600),
        ),
    ),

  async execute(interaction) {
    const reply = (content) => interaction.reply({ content, flags: MessageFlags.Ephemeral });
    if (!isStaff(interaction.member)) return reply('Staff only.');

    const { channel, guild } = interaction;
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'lockdown' || sub === 'unlockdown') {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        let changed = 0;
        for (const ch of guild.channels.cache.values()) {
          if (!ch.isTextBased() || !ch.permissionOverwrites) continue;
          try { await ch.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: sub === 'lockdown' ? false : null }, { reason: `${sub} by ${interaction.user.username}` }); changed++; }
          catch (err) { console.error(`[${sub}] ${ch.id}`, err); }
        }
        return interaction.editReply(`${sub === 'lockdown' ? 'Locked' : 'Unlocked'} ${changed} text channel(s).`);
      }
      if (sub === 'lock') {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: false }, { reason: `Locked by ${interaction.user.username}` });
        return interaction.reply({ content: `🔒 This channel was locked by ${interaction.user}.`, allowedMentions: { parse: [] } });
      }
      if (sub === 'unlock') {
        await channel.permissionOverwrites.edit(guild.roles.everyone, { SendMessages: null }, { reason: `Unlocked by ${interaction.user.username}` });
        return interaction.reply({ content: `🔓 This channel was unlocked by ${interaction.user}.`, allowedMentions: { parse: [] } });
      }
      const seconds = interaction.options.getInteger('seconds', true);
      await channel.setRateLimitPerUser(seconds, `Set by ${interaction.user.username}`);
      return reply(seconds ? `Slowmode set to ${seconds} second(s).` : 'Slowmode turned off.');
    } catch (err) {
      console.error(err);
      return reply('I could not change this channel. Check my Manage Channels permission.');
    }
  },
};
