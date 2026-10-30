const { SlashCommandBuilder, ChannelType, GuildFeature, escapeMarkdown } = require('discord.js');
const m = require('../utils/moderation');
const { panel, colors } = require('../utils/presentation');
const date = ms => ms ? `<t:${Math.floor(ms / 1000)}:D> · <t:${Math.floor(ms / 1000)}:R>` : 'Not available';
const channel = id => id ? `<#${id}>` : 'Not configured';
const label = value => escapeMarkdown(String(value || 'Not available')).slice(0, 180);
const rolesText = (roles, guildId) => {
  const all = [...roles.values()].filter(r => r.id !== guildId).sort((a, b) => b.position - a.position);
  return `${all.slice(0, 15).map(r => `<@&${r.id}>`).join(' ') || 'None'}${all.length > 15 ? `\n…and **${all.length - 15}** more. Use /roles to browse.` : ''}`;
};
async function serverView(i) {
  const guild = await i.guild.fetch().catch(() => i.guild);
  await Promise.all([guild.channels.fetch().catch(() => null), guild.roles.fetch().catch(() => null)]);
  const owner = await guild.fetchOwner().catch(() => null);
  const me = guild.members.me;
  const channels = [...guild.channels.cache.values()];
  const count = (...types) => channels.filter(c => types.includes(c.type)).length;
  const threads = channels.filter(c => c.isThread?.()).length;
  const verification = ['None', 'Low', 'Medium', 'High', 'Very high'][guild.verificationLevel] || 'Unknown';
  const filter = ['Disabled', 'Members without roles', 'All members'][guild.explicitContentFilter] || 'Unknown';
  const features = guild.features.map(f => label(f.toLowerCase().split('_').map(s => s[0].toUpperCase() + s.slice(1)).join(' '))).join(' • ');
  return panel('Server information', [
    { title: 'Basic information', body: `**Name:** ${label(guild.name)}\n**Owner:** ${owner ? `<@${owner.id}>` : guild.ownerId ? `<@${guild.ownerId}>` : 'Not available'}\n**Created:** ${date(guild.createdTimestamp)}\n**Bot joined:** ${date(me?.joinedTimestamp)}\n**Members:** ${guild.memberCount.toLocaleString()}\n**Nitro boosts:** ${guild.premiumSubscriptionCount || 0} · Level ${guild.premiumTier}\n**Notifications:** ${guild.defaultMessageNotifications === 1 ? 'Only mentions' : 'All messages'}` },
    { title: 'Security', body: `**Moderator 2FA:** ${guild.mfaLevel === 1 ? 'Required' : 'Not required'}\n**Verification level:** ${verification}\n**Explicit content filter:** ${filter}\n**Membership screening:** ${guild.features.includes(GuildFeature.MemberVerificationGateEnabled) ? 'Enabled' : 'Disabled'}` },
    { title: 'Server configuration', body: `**Rules:** ${channel(guild.rulesChannelId)}\n**System messages:** ${channel(guild.systemChannelId)}\n**Community updates:** ${channel(guild.publicUpdatesChannelId)}\n**AFK channel:** ${channel(guild.afkChannelId)}\n**Preferred locale:** ${guild.preferredLocale || 'Not available'}` },
    { title: `Channels · ${channels.length} cached`, body: `**Categories:** ${count(ChannelType.GuildCategory)}  •  **Text:** ${count(ChannelType.GuildText)}\n**Voice:** ${count(ChannelType.GuildVoice)}  •  **Stage:** ${count(ChannelType.GuildStageVoice)}\n**Announcements:** ${count(ChannelType.GuildAnnouncement)}  •  **Forums:** ${count(ChannelType.GuildForum)}\n**Media:** ${count(ChannelType.GuildMedia)}  •  **Cached threads:** ${threads}\n-# Archived and uncached threads are not included.` },
    { title: `Roles · ${Math.max(0, guild.roles.cache.size - 1)} excluding @everyone`, body: rolesText(guild.roles.cache, guild.id) },
    { title: 'Server features', body: features.slice(0, 500) || 'No additional features enabled.' },
  ], { subtitle: label(guild.name), thumbnail: guild.iconURL?.({ size: 256 }), footer: `Server ID: ${guild.id}`, color: colors.primary });
}
async function userView(i) {
  const user = i.options.getUser('user') || i.user;
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  const records = m.active(i.guildId, user.id).filter(c => c.type !== 'staffwarn');
  return panel('Member information', [
    { title: 'Profile', body: `**Member:** <@${user.id}>\n**Username:** ${label(user.tag || user.username)}\n**Display name:** ${label(member?.displayName || user.globalName || user.username)}\n**Account type:** ${user.bot ? 'Bot' : 'Member'}\n**Account created:** ${date(user.createdTimestamp)}` },
    { title: 'Server membership', body: member ? `**Joined:** ${date(member.joinedTimestamp)}\n**Boosting since:** ${date(member.premiumSinceTimestamp)}\n**Highest role:** <@&${member.roles.highest.id}>\n**Timeout:** ${member.communicationDisabledUntilTimestamp > Date.now() ? date(member.communicationDisabledUntilTimestamp) : 'Not active'}` : 'This user is not currently in the server.' },
    { title: 'Moderation summary · Staff only', body: `**Active cases:** ${records.length}\n**Warnings:** ${records.filter(c => c.type === 'warn').length}\n**Warning points:** ${records.reduce((n, c) => n + (c.points || 0), 0)}\nUse /dashboard user: or /modlogs for details.` },
    { title: 'Roles', body: member ? rolesText(member.roles.cache, i.guildId) : 'Not in this server.' },
  ], { thumbnail: user.displayAvatarURL?.({ size: 256 }), footer: `User ID: ${user.id}` });
}
module.exports = {
  data: new SlashCommandBuilder().setName('info').setDescription('View organised server and member information').setDMPermission(false)
    .addSubcommand(s => s.setName('server').setDescription('Server overview, security, channels and roles'))
    .addSubcommand(s => s.setName('user').setDescription('Member profile, roles and moderation summary').addUserOption(o => o.setName('user').setDescription('Member; defaults to yourself'))),
  async execute(i, forced) {
    await i.deferReply({ flags: 64 });
    try {
      m.authorize(i);
      const payload = await ((forced || i.options.getSubcommand()) === 'server' ? serverView(i) : userView(i));
      return i.editReply(payload);
    } catch (e) { return i.editReply(panel('Information unavailable', [e.message], { color: colors.danger, footer: 'Staff tools' })); }
  },
  serverView, userView,
};
