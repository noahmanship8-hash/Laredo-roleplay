const { make, user, reason } = require('../utils/command-factory');
const m = require('../utils/moderation');
const db = require('../utils/db');
module.exports = make('note', 'Add, edit or remove a private moderator note', b => {
  b.addSubcommand(s => { s.setName('add').setDescription('Add a private note'); user(s); reason(s); return s; });
  for (const action of ['edit', 'remove']) b.addSubcommand(s => { s.setName(action).setDescription(`${action} a private note`).addIntegerOption(o => o.setName('id').setDescription('Note ID').setRequired(true).setMinValue(1)); reason(s); return s; });
}, async i => {
  await i.deferReply({ flags: 64 });
  try {
    m.authorize(i);
    const sub = i.options.getSubcommand(); const reason = i.options.getString('reason');
    let n;
    if (sub === 'add') { n = { id: Math.max(0, ...db.data.notes.map(n => n.id)) + 1, guildId: i.guildId, userId: i.options.getUser('user').id, text: reason, by: i.user.id, at: Date.now(), edits: [] }; db.data.notes.push(n); }
    else {
      n = db.data.notes.find(n => n.id === i.options.getInteger('id') && n.guildId === i.guildId);
      if (!n || n.removed) throw new Error('No active note with that ID.');
      n.edits.push({ text: n.text, by: i.user.id, at: Date.now(), reason });
      if (sub === 'edit') n.text = reason;
      else { n.removed = true; n.removedBy = i.user.id; }
    }
    db.save(); return i.editReply(m.payload('Private note updated', `Note #${n.id} • ${sub}. Edit history is retained.`));
  } catch (e) { return i.editReply(m.payload('Action not completed', e.message)); }
});
