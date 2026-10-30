const { ActionRowBuilder, ButtonBuilder, ButtonStyle, UserSelectMenuBuilder, escapeMarkdown } = require('discord.js');
const { make, user } = require('../utils/command-factory');
const m = require('../utils/moderation');
const db = require('../utils/db');
const { panel, colors, V2 } = require('../utils/presentation');
const TABS = ['overview', 'cases', 'warnings', 'tools', 'settings'];
function view(i, userId, tab = 'overview', page = 1) {
  m.authorize(i);
  if (!TABS.includes(tab)) throw new Error('This tab is no longer available. Open /dashboard again.');
  if (tab === 'settings' && !m.manager(i)) throw new Error('Only administrators can view the settings tab.');
  const records = m.active(i.guildId, userId === 'all' ? null : userId).filter(c => c.type !== 'staffwarn');
  const sections = [];
  let totalPages = 1;
  const warnings = records.filter(c => c.type === 'warn');
  const e = db.data.escalation[i.guildId];
  if (tab === 'overview') {
    const recent = records.filter(c => c.at >= Date.now() - 86400000);
    sections.push({ title: 'At a glance', body: `**${records.length}** active case records  •  **${warnings.length}** warnings\n**${records.reduce((n, c) => n + (c.points || 0), 0)}** warning points  •  **${recent.length}** cases in the last 24 hours\n-# Case records are not a live count of current Discord punishments.` });
    sections.push({ title: 'Latest activity', body: records.slice(-3).reverse().map(c => `**#${c.id} · ${c.type}** — <@${c.userId}>\n${escapeMarkdown(String(c.reason)).slice(0, 100)} · <t:${Math.floor(c.at / 1000)}:R>`).join('\n\n') || 'No active cases in this view. New actions will appear here.' });
    sections.push({ title: 'Warning escalation', body: e?.enabled ? `**Enabled** · Timeout at **${e.timeoutAt}** warnings for **${e.timeoutMinutes} minutes** · Ban at **${e.banAt}** warnings.` : '**Disabled** · Warnings do not trigger an automatic punishment.' });
    sections.push({ title: 'Quick start', body: 'Choose a member below to filter the dashboard.\nUse **Cases** for history, **Warnings** for warning records, or **Tools** for the command guide.\nStaff discipline stays separate in administrator-only `/staffwarn`.' });
  } else if (tab === 'cases' || tab === 'warnings') {
    const list = (tab === 'warnings' ? warnings : records).slice().reverse();
    totalPages = Math.max(1, Math.ceil(list.length / 8));
    page = Math.min(Math.max(1, Number.isFinite(page) ? Math.floor(page) : 1), totalPages);
    sections.push(`**${list.length}** records · Page **${page} of ${totalPages}**\nUse /case for details or /mod remove to void a case. Voiding a record does not reverse a Discord punishment.`);
    for (const c of list.slice((page - 1) * 8, page * 8)) sections.push({ title: `#${c.id} · ${c.type}`, body: `**Member:** <@${c.userId}>  •  **Moderator:** <@${c.modId}>\n${escapeMarkdown(String(c.reason)).slice(0, 140)}\n-# <t:${Math.floor(c.at / 1000)}:f> · ${c.points || 0} points` });
    if (!list.length) sections.push({ title: 'All clear', body: `No active ${tab === 'warnings' ? 'warnings' : 'case records'} for this scope.` });
  } else if (tab === 'tools') {
    sections.push({ title: 'Moderation', body: '`/warn` · `/mute` · `/unmute` · `/kick` · `/ban` · `/unban`\nActions require staff access, the relevant Discord permission and a valid role hierarchy.' });
    sections.push({ title: 'Records & staff', body: '`/case` · `/editcase` · `/modlogs` · `/points`\n`/note` · `/notes` · `/modstats`\n`/staffwarn` is administrator-only.' });
    sections.push({ title: 'Community & channels', body: '`/role` · `/roles` · `/members` · `/selfrole`\n`/lock` · `/unlock` · `/slowmode` · `/purge`\n`/info server` · `/info user` · `/avatar`' });
    sections.push({ title: 'Server setup', body: '`/logging` — choose event-log destinations\n`/autorole` — safe join/verified roles\n`/mod escalation` — automatic warning thresholds\nSetup permissions are checked by each command.' });
  } else {
    const logSettings = db.data.logging?.[i.guildId] || {};
    const community = db.data.community?.[i.guildId];
    sections.push({ title: 'Warning escalation', body: e?.enabled ? `**Enabled**\nTimeout: **${e.timeoutAt}** warnings → **${e.timeoutMinutes} minutes**\nBan: **${e.banAt}** warnings\nChange with /mod escalation.` : '**Disabled**\nConfigure with /mod escalation. Changes do not retroactively punish members.' });
    sections.push({ title: 'Event logging', body: Object.entries(logSettings).map(([name, id]) => `**${name}:** <#${id}>`).join('\n') || 'No event logs configured. Use /logging set.' });
    sections.push({ title: 'Community automation', body: `**Auto-roles:** ${community?.autoroleEnabled === false ? 'Paused' : 'Ready'} · ${community?.autoroles?.length || 0} rules\n**Optional roles:** ${community?.selfroles?.length || 0}\n**Verification:** ${db.data.verification[i.guildId]?.enabled ? 'Enabled' : 'Disabled'}\nUse /autorole, /selfrole allow and /verification to configure.` });
  }
  const button = (label, nextTab, nextPage = 1, action = nextTab) => new ButtonBuilder().setCustomId(`dash:${i.user.id}:${userId}:${nextTab}:${nextPage}:${action}`).setLabel(label).setStyle(nextTab === tab ? ButtonStyle.Primary : ButtonStyle.Secondary);
  const tabs = new ActionRowBuilder().addComponents(...TABS.map(t => button(t[0].toUpperCase() + t.slice(1), t).setDisabled(t === 'settings' && !m.manager(i))));
  const navigation = new ActionRowBuilder();
  if (tab === 'cases' || tab === 'warnings') navigation.addComponents(button('Previous', tab, Math.max(1, page - 1), 'previous').setDisabled(page <= 1), button('Next', tab, Math.min(totalPages, page + 1), 'next').setDisabled(page >= totalPages));
  navigation.addComponents(button('Refresh', tab, page, 'refresh'), button('All members', 'overview', 1, 'all').setCustomId(`dash:${i.user.id}:all:overview:1:all`).setDisabled(userId === 'all'));
  const scope = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`dashscope:${i.user.id}`).setPlaceholder('Filter by a member…').setMinValues(1).setMaxValues(1));
  return panel('Moderation dashboard', sections, { subtitle: `${userId === 'all' ? '**Server overview**' : `**Member:** <@${userId}>`} · ${tab[0].toUpperCase() + tab.slice(1)}`, rows: [tabs, navigation, scope], footer: 'Staff workspace • Private records', color: colors.primary });
}
module.exports = make('dashboard', 'Open the Components V2 staff workspace', b => user(b, false), async i => {
  try { m.authorize(i); await i.reply({ ...view(i, i.options.getUser('user')?.id || 'all'), flags: V2 | 64 }); }
  catch (e) { await i.reply({ ...panel('Dashboard unavailable', [e.message], { color: colors.danger, ephemeral: true }), allowedMentions: { parse: [] } }); }
});
module.exports.button = async i => {
  try {
    const [, owner, userId, tab, page] = i.customId.split(':');
    if (owner !== i.user.id) throw new Error('Open your own panel with /dashboard.');
    const payload = view(i, userId, tab, Number(page));
    // Clear the old embed too, so panels posted before this update can upgrade safely.
    await i.update({ ...payload, content: null, embeds: [] });
  } catch (e) { await i.reply(panel('Dashboard unavailable', [e.message], { color: colors.danger, ephemeral: true })); }
};
module.exports.select = async i => {
  try {
    const owner = i.customId.split(':')[1];
    if (owner !== i.user.id) throw new Error('Open your own panel with /dashboard.');
    await i.update({ ...view(i, i.values[0], 'overview', 1), content: null, embeds: [] });
  } catch (e) { await i.reply(panel('Dashboard unavailable', [e.message], { color: colors.danger, ephemeral: true })); }
};
module.exports.view = view;
