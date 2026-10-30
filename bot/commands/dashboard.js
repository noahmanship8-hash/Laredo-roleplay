const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { make, user } = require('../utils/command-factory');
const m = require('../utils/moderation');
function view(i, userId, tab = 'overview', page = 1) {
  m.authorize(i);
  const records = m.active(i.guildId, userId === 'all' ? null : userId).filter(c => c.type !== 'staffwarn');
  let text;
  let totalPages = 1;
  if (tab === 'overview') text = `**Scope:** ${userId === 'all' ? 'This server' : `<@${userId}>`}\n**Active cases:** ${records.length}\n**Warnings:** ${records.filter(c => c.type === 'warn').length}\n**Warning points:** ${records.reduce((n, c) => n + (c.points || 0), 0)}\n\nUse the tabs to browse records.\nIssue actions with /warn, /mute, /kick or /ban.\nReview or void records with /case and /mod remove.\nStaff warnings are separate: /staffwarn.\nEscalation settings: /mod escalation settings.`;
  else {
    const list = records.filter(c => tab !== 'warnings' || c.type === 'warn').reverse();
    totalPages = Math.max(1, Math.ceil(list.length / 8));
    page = Math.min(Math.max(1, page), totalPages);
    text = `Page **${page}/${Math.max(1, Math.ceil(list.length / 8))}**\n\n${m.lines(list.slice((page - 1) * 8, page * 8)) || 'No records found.'}`;
  }
  const button = (label, nextTab, nextPage = 1, action = nextTab) => new ButtonBuilder().setCustomId(`dash:${i.user.id}:${userId}:${nextTab}:${nextPage}:${action}`).setLabel(label).setStyle(nextTab === tab ? ButtonStyle.Primary : ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(button('Overview', 'overview'), button('Cases', 'cases'), button('Warnings', 'warnings'));
  const rows = [row];
  if (tab !== 'overview') rows.push(new ActionRowBuilder().addComponents(button('Previous', tab, Math.max(1, page - 1), 'previous').setDisabled(page <= 1), button('Next', tab, Math.min(totalPages, page + 1), 'next').setDisabled(page >= totalPages)));
  return m.payload('Moderation dashboard', text, { components: rows });
}
module.exports = make('dashboard', 'Open your private moderation dashboard', b => user(b, false), async i => {
  try { m.authorize(i); await i.reply({ ...view(i, i.options.getUser('user')?.id || 'all'), flags: 64 }); }
  catch (e) { await i.reply({ ...m.payload('Access denied', e.message), flags: 64 }); }
});
module.exports.button = async i => {
  try {
    const [, owner, userId, tab, page] = i.customId.split(':');
    if (owner !== i.user.id) throw new Error('Open your own panel with /dashboard.');
    await i.update(view(i, userId, tab, Number(page)));
  } catch (e) { await i.reply({ ...m.payload('Access denied', e.message), flags: 64 }); }
};
