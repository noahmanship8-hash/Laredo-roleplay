const { PermissionFlagsBits: P } = require('discord.js');
const m = require('./moderation'); const db = require('./db');
async function execute(i, name) {
  await i.deferReply({ flags: 64 });
  const reply = text => i.editReply(m.payload(name.charAt(0).toUpperCase() + name.slice(1), text));
  try {
    m.authorize(i);
    if (['lock', 'unlock'].includes(name)) {
      m.authorize(i, P.ManageChannels);
      const ch = i.options.getChannel('channel') || i.channel;
      if (!ch.permissionOverwrites || !ch.isTextBased() || ch.isThread()) throw new Error('Choose a text channel, not a thread.');
      const key = `${i.guildId}:${ch.id}`;
      if (name === 'unlock') {
        const entry = db.data.locks[key]; if (!entry) throw new Error('This bot has no stored lock for that channel.');
        await require('./channel-locks').restore(i.guild, entry); return reply('The previous @everyone Send Messages overwrite was restored.');
      }
      if (db.data.locks[key]) throw new Error('That channel is already locked by this bot.');
      const overwrite = ch.permissionOverwrites.cache.get(i.guildId);
      const before = overwrite?.allow.has(P.SendMessages) ? true : overwrite?.deny.has(P.SendMessages) ? false : null;
      const minutes = i.options.getInteger('minutes');
      // Persist intent first, so a restart cannot lose the original overwrite.
      db.data.locks[key] = { guildId: i.guildId, channelId: ch.id, before, expiresAt: minutes ? Date.now() + minutes * 60000 : null, by: i.user.id }; db.save();
      try { await ch.permissionOverwrites.edit(i.guild.roles.everyone, { SendMessages: false }, { reason: `Locked by ${i.user.id}` }); }
      catch (e) { delete db.data.locks[key]; db.save(); throw e; }
      return reply(`Locked <#${ch.id}>${minutes ? ` for ${minutes} minutes` : ' until /unlock'}.\nOnly @everyone is changed; other role/member allows can still grant access.`);
    }
    if (name === 'locked') return reply(Object.values(db.data.locks).filter(e => e.guildId === i.guildId).map(e => `<#${e.channelId}> · ${e.expiresAt ? `<t:${Math.floor(e.expiresAt / 1000)}:R>` : 'Manual unlock'}`).join('\n'));
    if (name === 'roles') {
      const user = i.options.getUser('user'); const query = (i.options.getString('search') || '').toLowerCase();
      const roles = user ? (await i.guild.members.fetch(user.id)).roles.cache : await i.guild.roles.fetch();
      const list = [...roles.values()].filter(r => r.name.toLowerCase().includes(query)).sort((a,b) => b.position - a.position);
      const page = i.options.getInteger('page') || 1;
      return reply(`Page ${page} · ${list.length} roles\n` + list.slice((page - 1) * 20, page * 20).map(r => `<@&${r.id}> · ${r.id}`).join('\n'));
    }
    if (name === 'members') {
      const include = i.options.getRole('include'), exclude = i.options.getRole('exclude');
      const members = await i.guild.members.fetch(); const list = [...members.values()].filter(u => (!include || u.roles.cache.has(include.id)) && (!exclude || !u.roles.cache.has(exclude.id)));
      const page = i.options.getInteger('page') || 1;
      return reply(`Matches: ${list.length} · Page ${page}\n` + list.slice((page-1)*20, page*20).map(u => `<@${u.id}> · ${u.id}`).join('\n'));
    }
    if (name === 'modstats') {
      const user = i.options.getUser('user'); const counts = new Map();
      for (const c of m.scope(i.guildId).filter(c => !c.removed && c.type !== 'staffwarn' && (!user || c.modId === user.id))) counts.set(c.modId, (counts.get(c.modId) || 0) + 1);
      return reply([...counts].sort((a,b) => b[1]-a[1]).slice(0,20).map(([id,n]) => `<@${id}> · **${n}** actions`).join('\n'));
    }
    if (name === 'moderations') {
      const members = await i.guild.members.fetch();
      return reply([...members.values()].filter(u => u.communicationDisabledUntilTimestamp > Date.now()).slice(0,25).map(u => `<@${u.id}> · Timeout ends <t:${Math.floor(u.communicationDisabledUntilTimestamp/1000)}:R>`).join('\n') || 'No active Discord timeouts. Temporary bans are not implemented.');
    }
    if (name === 'nick') {
      m.authorize(i, P.ManageNicknames);
      const target = await i.guild.members.fetch(i.options.getUser('user').id);
      if (target.id === i.guild.ownerId) throw new Error('Discord does not let bots change the server owner’s nickname. Change it yourself through your server profile.');
      if (target.id !== i.user.id) {
        const problem = require('./perms').hierarchyProblem(i.guild, i.member, target);
        if (problem) throw new Error(problem);
      }
      if (!i.guild.members.me.permissions.has(P.ManageNicknames)) throw new Error('The bot needs the Manage Nicknames permission.');
      if (target.roles.highest.position >= i.guild.members.me.roles.highest.position) throw new Error('Move the bot’s role above your highest role (or the target member’s highest role), then try again.');
      await target.setNickname(i.options.getString('nickname'), `Changed by ${i.user.id}`); return reply('Nickname updated. Omit nickname to restore the username.');
    }
    if (name === 'clean') {
      m.authorize(i, P.ManageMessages);
      const messages = await i.channel.messages.fetch({ limit: 100 });
      const deleted = await i.channel.bulkDelete(messages.filter(msg => msg.author.id === i.client.user.id).first(i.options.getInteger('amount') || 20), true);
      return reply(`Deleted ${deleted.size} recent bot messages. Messages older than 14 days are skipped.`);
    }
    if (name === 'inviteinfo') {
      const invite = await i.client.fetchInvite(i.options.getString('invite'));
      return reply(`**Server:** ${invite.guild?.name || 'Unknown'}\n**Channel:** ${invite.channel?.name || 'Unknown'}\n**Inviter:** ${invite.inviter?.tag || 'Unknown'}\n**Members:** ${invite.memberCount ?? 'Unknown'}\n**Expires:** ${invite.expiresTimestamp ? `<t:${Math.floor(invite.expiresTimestamp/1000)}:R>` : 'Not provided'}`);
    }
    if (name === 'diagnose') {
      const me = await i.guild.members.fetchMe();
      const checks = ['ViewChannel','SendMessages','EmbedLinks','ReadMessageHistory','ModerateMembers','KickMembers','BanMembers','ManageRoles','ManageChannels','ManageMessages'];
      return reply(checks.map(p => `${me.permissions.has(P[p]) ? '✓' : '✗'} ${p}`).join('\n') + `\n\nBot highest role: ${me.roles.highest.name}\nChannel overrides and role hierarchy may still prevent specific actions.\nLoaded commands: ${i.client.commands.size}`);
    }
    if (name === 'presets') return reply('No moderation reason presets are configured. Supply a clear reason when issuing an action.');
    throw new Error('Unknown tool.');
  } catch (e) { return reply(`Action not completed: ${e.message}`); }
}
module.exports = { execute };
