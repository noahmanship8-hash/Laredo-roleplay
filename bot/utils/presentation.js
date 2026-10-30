const {
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize,
  SectionBuilder, ThumbnailBuilder, MediaGalleryBuilder, MediaGalleryItemBuilder,
  MessageFlags,
} = require('discord.js');
const config = require('../config');
const V2 = MessageFlags.IsComponentsV2;
const colors = { primary: 0x5865F2, success: 0x57F287, warning: 0xF0B232, danger: 0xED4245 };
const cut = (text, max) => { const value = String(text ?? ''); return value.length > max ? value.slice(0, Math.max(0, max - 1)) + '…' : value; };
function panel(title, sections = [], options = {}) {
  const container = new ContainerBuilder().setAccentColor(options.color ?? colors.primary);
  let budget = 3450;
  const text = value => {
    const content = cut(value, Math.min(3500, budget));
    budget -= content.length;
    return new TextDisplayBuilder().setContent(content || '—');
  };
  const heading = `## ${cut(title, 180)}${options.subtitle ? `\n${cut(options.subtitle, 300)}` : ''}`;
  if (options.thumbnail && /^https:\/\//.test(options.thumbnail)) {
    container.addSectionComponents(new SectionBuilder().addTextDisplayComponents(text(heading)).setThumbnailAccessory(new ThumbnailBuilder().setURL(options.thumbnail)));
  } else container.addTextDisplayComponents(text(heading));
  for (const section of sections) {
    if (budget < 100) break;
    const body = typeof section === 'string' ? section : `### ${section.title}\n${section.body || 'Nothing to show yet.'}`;
    if (!body.trim()) continue;
    container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
    container.addTextDisplayComponents(text(body));
  }
  if (options.image && /^https:\/\//.test(options.image)) container.addMediaGalleryComponents(new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(options.image)));
  for (const row of options.rows || []) container.addActionRowComponents(row);
  container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small).setDivider(true));
  const footer = String(options.footer || 'Community utilities').replace(`${config.name} • `, '');
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# ${cut(config.name, 100)} • ${cut(footer, 200)} • <t:${Math.floor(Date.now() / 1000)}:t>`));
  return { components: [container], flags: V2 | (options.ephemeral ? MessageFlags.Ephemeral : 0), allowedMentions: { parse: [] } };
}
function json(component) { return typeof component.toJSON === 'function' ? component.toJSON() : component; }
function isV2(payload) {
  return (Number(payload.flags || 0) & V2) !== 0 || payload.components?.some(c => [9, 10, 12, 14, 17].includes(json(c).type));
}
// Standardise ordinary slash-command responses without converting legacy interactive
// messages (gambling/verification/appeals), attachments, modals, or existing V2 panels.
function format(input, title, edit = false) {
  let body = typeof input === 'string' ? { content: input } : input;
  if (!body || typeof body !== 'object') return input;
  if (isV2(body)) {
    const flags = Number(body.flags || 0) | V2;
    return { ...body, flags: edit ? flags & ~MessageFlags.Ephemeral : flags, allowedMentions: body.allowedMentions || { parse: [] } };
  }
  if (body.embeds?.length) body = { ...body, embeds: body.embeds.map(value => {
    const embed = json(value);
    return { ...embed, color: embed.color ?? colors.primary, footer: embed.footer || { text: `${config.name} • Community utilities` }, timestamp: embed.timestamp || new Date().toISOString() };
  }) };
  if (body.components?.length || body.files?.length || body.attachments?.length || body.poll || body.stickers || body.withResponse || body.fetchReply) return body;
  if (!body.content && !body.embeds?.length) return input;
  const embeds = (body.embeds || []).map(json);
  // Avoid reworking complex image or multi-embed layouts through the generic adapter.
  if (embeds.length > 1) return body;
  const embed = embeds[0];
  const sections = [];
  if (body.content) sections.push(body.content);
  if (embed?.description) sections.push(embed.description);
  if (embed?.fields) for (const field of embed.fields) sections.push({ title: field.name, body: field.value });
  const danger = /denied|not completed|failed|error/i.test(embed?.title || title);
  const result = panel(embed?.title || title, sections, {
    color: danger ? colors.danger : embed?.color,
    thumbnail: embed?.thumbnail?.url, image: embed?.image?.url,
    footer: embed?.footer?.text || 'Command response',
  });
  result.flags |= Number(body.flags || 0);
  if (edit) result.flags &= ~MessageFlags.Ephemeral;
  // Clear old content/embeds when converting an already-existing response to V2.
  if (edit) { result.content = null; result.embeds = []; }
  return { ...body, ...result, ...(edit ? {} : { content: undefined, embeds: undefined }) };
}
function install(interaction) {
  if (interaction.__laredoPresentation) return;
  interaction.__laredoPresentation = true;
  const title = interaction.commandName ? `${interaction.commandName.charAt(0).toUpperCase()}${interaction.commandName.slice(1)}` : 'Laredo utilities';
  for (const method of ['reply', 'editReply', 'followUp']) {
    if (typeof interaction[method] !== 'function') continue;
    const original = interaction[method].bind(interaction);
    interaction[method] = input => original(format(input, title, method === 'editReply'));
  }
}
module.exports = { panel, format, install, colors, V2 };
