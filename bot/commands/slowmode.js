const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const { make } = require('../utils/command-factory');
const m = require('../utils/moderation');
module.exports = make('slowmode', 'Set or disable a channel message cooldown', b => {
  b.addIntegerOption(o => o.setName('seconds').setDescription('Cooldown in seconds; 0 disables (maximum 21600 = 6 hours)').setRequired(true).setMinValue(0).setMaxValue(21600));
  b.addChannelOption(o => o.setName('channel').setDescription('Defaults to this channel').addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildStageVoice));
}, async i => {
  await i.deferReply({ flags: 64 });
  try {
    m.authorize(i, P.ManageChannels);
    const channel = i.options.getChannel('channel') || i.channel;
    if (typeof channel.setRateLimitPerUser !== 'function' || channel.isThread()) throw new Error('Choose a normal server text or voice-chat channel, not a thread.');
    const me = await i.guild.members.fetchMe();
    if (!channel.permissionsFor(me)?.has(P.ManageChannels)) throw new Error('The bot needs Manage Channels here.');
    if (!channel.permissionsFor(i.member)?.has(P.ManageChannels)) throw new Error('You need Manage Channels here.');
    const seconds = i.options.getInteger('seconds', true);
    await channel.setRateLimitPerUser(seconds, `Slowmode changed by ${i.user.id}`);
    return i.editReply(m.payload('Slowmode updated', `<#${channel.id}>: ${seconds ? `**${seconds} seconds** between messages.` : '**Disabled**.'}\nDiscord exempts members with certain moderation permissions from slowmode.`));
  } catch (e) { return i.editReply(m.payload('Slowmode action not completed', e.message)); }
});
