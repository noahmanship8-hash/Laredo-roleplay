const { PermissionFlagsBits: P } = require('discord.js');
const db = require('./db');
const m = require('./moderation');
async function execute(i, forced) {
  await i.deferReply({ flags: 64 });
  const reply = (title, text) => i.editReply(m.payload(title, text));
  try {
    m.authorize(i);
    const sub = forced || i.options.getSubcommand();
    const group = !forced && i.options.getSubcommandGroup(false);
    if (group === 'escalation') {
      m.authorize(i, null, true);
      const e = db.data.escalation[i.guildId] ||= { enabled: false, timeoutAt: 3, timeoutMinutes: 60, banAt: 5 };
      if (sub === 'toggle') e.enabled = i.options.getBoolean('enabled');
      if (sub === 'settimeout') { const n = i.options.getInteger('warnings'); if (n >= e.banAt) throw new Error('Timeout threshold must be below the ban threshold.'); e.timeoutAt = n; e.timeoutMinutes = i.options.getInteger('minutes'); }
      if (sub === 'setban') { const n = i.options.getInteger('warnings'); if (n <= e.timeoutAt) throw new Error('Ban threshold must be above the timeout threshold.'); e.banAt = n; }
      db.save(); return reply('Warning escalation', `**Status:** ${e.enabled ? 'Enabled' : 'Disabled'}\n**${e.timeoutAt} warnings:** timeout for ${e.timeoutMinutes} minutes\n**${e.banAt} warnings:** ban\nActions run only when a new warning reaches the threshold. The issuing moderator must have the required Discord permissions.`);
    }
    if (['remove', 'case', 'editcase'].includes(sub)) {
      const c = m.scope(i.guildId).find(c => c.id === i.options.getInteger('case'));
      if (!c) throw new Error('No matching case exists in this server.');
      if (c.type === 'staffwarn') m.authorize(i, null, true);
      if (sub === 'remove') { c.removed = true; c.removedBy = i.user.id; c.removedAt = Date.now(); db.save(); }
      if (sub === 'editcase') {
        const reason = i.options.getString('reason');
        if (!reason) throw new Error('Provide a new reason. Duration changes are not supported yet; use /mute or /unmute to change a timeout.');
        (c.edits ||= []).push({ reason: c.reason, by: i.user.id, at: Date.now() }); c.reason = reason; db.save();
      }
      return reply(`Case #${c.id}`, m.lines([c]));
    }
    if (sub === 'unban') {
      const id = i.options.getString('user_id', true);
      if (!/^\d{17,20}$/.test(id)) throw new Error('Enter a valid Discord user ID.');
      const user = await i.client.users.fetch(id);
      return reply('Unban', await m.punish(i, sub, user, i.options.getString('reason') || 'Ban lifted'));
    }
    const user = i.options.getUser('user', true);
    if (['history', 'warnings', 'clearwarnings', 'points'].includes(sub)) {
      const records = m.active(i.guildId, user.id).filter(c => c.type !== 'staffwarn');
      if (sub === 'clearwarnings') {
        m.authorize(i, P.ModerateMembers);
        const target = await i.guild.members.fetch(user.id).catch(() => null);
        if (target) { const problem = require('./perms').hierarchyProblem(i.guild, i.member, target); if (problem) throw new Error(problem); }
        for (const c of records.filter(c => c.type === 'warn')) { c.removed = true; c.removedBy = i.user.id; c.removedAt = Date.now(); }
        db.save(); return reply('Warnings cleared', 'Warnings were voided. Case history is retained for auditing.');
      }
      if (sub === 'points') return reply('Moderation points', `<@${user.id}> has **${records.reduce((n, c) => n + (c.points || 0), 0)}** active points. Each member warning adds one point.`);
      const page = i.options.getInteger('page') || 1;
      const all = records.filter(c => sub !== 'warnings' || c.type === 'warn').reverse();
      return reply(`Member ${sub} · Page ${page}/${Math.max(1, Math.ceil(all.length / 8))}`, m.lines(all.slice((page - 1) * 8, page * 8)));
    }
    return reply('Moderation action', await m.punish(i, sub, user, i.options.getString('reason') || 'Timeout lifted', i.options.getInteger('minutes')));
  } catch (e) { console.error('[moderation]', e); return reply('Action not completed', e.message); }
}
module.exports = { execute };
