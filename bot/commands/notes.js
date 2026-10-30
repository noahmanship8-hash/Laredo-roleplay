const { make, user, page } = require('../utils/command-factory');
const m = require('../utils/moderation'); const db = require('../utils/db');
module.exports = make('notes', 'View private member notes and note edit history', b => { user(b); b.addIntegerOption(o => o.setName('id').setDescription('Specific note ID').setMinValue(1)); page(b); }, async i => {
  try {
    m.authorize(i);
    const id = i.options.getInteger('id'), p = i.options.getInteger('page') || 1;
    const all = db.data.notes.filter(n => n.guildId === i.guildId && n.userId === i.options.getUser('user').id && (id ? n.id === id : !n.removed)).reverse();
    const text = all.slice((p - 1) * 8, p * 8).map(n => `**Note #${n.id}${n.removed ? ' · Removed' : ''}** · <@${n.by}>\n${n.text}${id ? '\n' + n.edits.slice(-5).map(e => `Previous: ${e.text} (edited by <@${e.by}>)`).join('\n') : ''}`).join('\n\n');
    return i.reply({ ...m.payload(`Private notes · Page ${p}`, text), flags: 64 });
  } catch (e) { return i.reply({ ...m.payload('Access denied', e.message), flags: 64 }); }
});
