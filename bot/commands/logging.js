const { PermissionFlagsBits: P, ChannelType } = require('discord.js');
const { make } = require('../utils/command-factory');
const m = require('../utils/moderation');
const db = require('../utils/db');
const logs = require('../utils/server-logs');
const category = b => b.addStringOption(o => o.setName('category').setDescription('Which events to configure').setRequired(true).addChoices(...['all', ...logs.categories].map(value => ({ name: value, value }))));
module.exports = make('logging', 'Choose channels for coloured server event logs', b => {
  b.setDefaultMemberPermissions(P.Administrator);
  b.addSubcommand(s => { s.setName('set').setDescription('Enable a log category in a channel'); category(s); return s.addChannelOption(o => o.setName('channel').setDescription('Private staff log channel').setRequired(true).addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)); });
  b.addSubcommand(s => { s.setName('disable').setDescription('Disable a log category'); category(s); return s; });
  b.addSubcommand(s => s.setName('status').setDescription('Show all log destinations and permission health'));
  b.addSubcommand(s => { s.setName('test').setDescription('Send a test event to a configured category'); category(s); return s; });
}, async i => {
  await i.deferReply({ flags: 64 });
  try {
    m.authorize(i, null, true);
    const sub = i.options.getSubcommand();
    const settings = (db.data.logging ||= {})[i.guildId] ||= {};
    const selected = i.options.getString('category');
    const categories = selected === 'all' ? logs.categories : [selected];
    const me = await i.guild.members.fetchMe();
    const needed = [P.ViewChannel, P.SendMessages, P.EmbedLinks];
    if (sub === 'status') {
      const lines = await Promise.all(logs.categories.map(async name => {
        const id = settings[name]; if (!id) return `**${name}:** Disabled`;
        const ch = await i.guild.channels.fetch(id).catch(() => null);
        return `**${name}:** <#${id}>${!ch ? ' · Channel missing' : !ch.permissionsFor(me)?.has(needed) ? ' · Bot permissions missing' : ''}`;
      }));
      return i.editReply(m.payload('Server logging settings', lines.join('\n') + `\n\n**View Audit Log:** ${me.permissions.has(P.ViewAuditLog) ? 'Granted' : 'Missing — audit events may be unavailable'}\nGreen: created/joined · Red: deleted/left · Yellow: changed · Blue: moved.\nKeep these channels private: logs can contain deleted messages and staff actions.`));
    }
    if (sub === 'set') {
      const channel = i.options.getChannel('channel', true);
      if (!channel.permissionsFor(me)?.has(needed)) throw new Error('Give the bot View Channel, Send Messages and Embed Links in that channel first.');
      for (const name of categories) settings[name] = channel.id;
      db.save();
      return i.editReply(m.payload('Server logging enabled', `**${selected}** logs → <#${channel.id}>\nUse /logging test to check delivery. Keep this channel staff-only.\nEnable Server Members and Message Content intents in the Developer Portal. Audit events also require View Audit Log.`));
    }
    if (sub === 'disable') {
      for (const name of categories) delete settings[name];
      db.save(); return i.editReply(m.payload('Server logging disabled', `Disabled **${selected}**. Previously posted logs were not deleted.`));
    }
    if (sub === 'test') {
      for (const name of categories) {
        if (!settings[name]) throw new Error(`${name} logs are not configured. Use /logging set first.`);
        const channel = await i.guild.channels.fetch(settings[name]).catch(() => null);
        if (!channel?.permissionsFor(me)?.has(needed)) throw new Error(`The bot cannot send ${name} logs. Check its channel permissions.`);
        await logs.send(i.guild, name, 'create', 'Logging test', `Server logging is configured for **${name}**. Test requested by <@${i.user.id}>.`);
      }
      return i.editReply(m.payload('Test logs sent', `Sent a test for **${selected}**.`));
    }
  } catch (e) { return i.editReply(m.payload('Logging configuration failed', e.message)); }
});
