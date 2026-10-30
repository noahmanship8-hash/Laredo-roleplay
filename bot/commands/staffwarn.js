const { make, user, reason, page } = require('../utils/command-factory');
const m = require('../utils/moderation');
const db = require('../utils/db');
module.exports = make('staffwarn', 'Administrator-only staff disciplinary records', b => {
  b.addSubcommand(s => { s.setName('add').setDescription('Record a confidential staff warning'); user(s); reason(s); return s; });
  b.addSubcommand(s => { s.setName('list').setDescription('View staff warnings'); user(s); page(s); return s; });
  b.addSubcommand(s => { s.setName('void').setDescription('Void a staff warning, retaining its history').addIntegerOption(o => o.setName('case').setDescription('Staff warning case ID').setRequired(true).setMinValue(1)); reason(s); return s; });
}, async i => {
  await i.deferReply({ flags: 64 });
  try {
    m.authorize(i, null, true);
    const sub = i.options.getSubcommand();
    if (sub === 'void') {
      const c = m.scope(i.guildId).find(c => c.id === i.options.getInteger('case') && c.type === 'staffwarn');
      if (!c) throw new Error('No matching staff warning.');
      c.removed = true; c.removedBy = i.user.id; c.removedAt = Date.now(); c.voidReason = i.options.getString('reason'); db.save();
      return i.editReply(m.payload('Staff warning voided', `Case #${c.id} remains in the audit history.`));
    }
    const target = i.options.getUser('user', true);
    if (sub === 'list') {
      const page = i.options.getInteger('page') || 1;
      const all = m.scope(i.guildId).filter(c => c.type === 'staffwarn' && c.userId === target.id).reverse();
      return i.editReply(m.payload(`Staff warnings · Page ${page}`, m.lines(all.slice((page - 1) * 8, page * 8))));
    }
    const member = await i.guild.members.fetch(target.id);
    if (!require('../utils/perms').isStaff(member)) throw new Error('That member is not configured as staff.');
    const problem = require('../utils/perms').hierarchyProblem(i.guild, i.member, member); if (problem) throw new Error(problem);
    // Staff discipline is deliberately not posted to the general moderation log.
    const c = { id: db.data.nextCaseId++, guildId: i.guildId, userId: target.id, modId: i.user.id, type: 'staffwarn', reason: i.options.getString('reason'), at: Date.now(), points: 0 };
    db.data.cases.push(c); db.save();
    return i.editReply(m.payload('Staff warning recorded', `**Case:** #${c.id}\n**Staff member:** <@${target.id}>\n**Reason:** ${c.reason}\nVisible only through administrator-only staff-warning tools.`));
  } catch (e) { return i.editReply(m.payload('Action not completed', e.message)); }
});
