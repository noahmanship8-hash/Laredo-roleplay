const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { MessageFlags, Collection, ChannelType, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laredo-design-'));
process.env.BOT_DB_PATH = path.join(dir, 'db.json');
const p = require('../utils/presentation');
const db = require('../utils/db');
after(() => fs.rmSync(dir, { recursive: true, force: true }));
const data = value => JSON.parse(JSON.stringify(value));
function walk(node, result = []) {
  if (!node || typeof node !== 'object') return result;
  if (typeof node.type === 'number') result.push(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) { for (const child of value) walk(child, result); }
    else if (value && typeof value === 'object') walk(value, result);
  }
  return result;
}
function staff() { return { permissions: { has: () => true }, roles: { cache: new Map() } }; }
test('plain command replies become branded V2 without losing ephemeral privacy', () => {
  const out = data(p.format({ content: 'Role added.', flags: 64 }, 'Roles'));
  assert.equal(out.flags, MessageFlags.IsComponentsV2 | 64);
  assert.equal(out.components[0].type, 17); assert.ok(!out.content); assert.ok(!out.embeds);
  assert.match(JSON.stringify(out), /Role added/); assert.match(JSON.stringify(out), /Laredo Roleplay/);
});
test('deferred edits clear legacy content and embeds and keep V2 flag', () => {
  const out = data(p.format({ embeds: [{ title: 'Warnings', description: 'No warnings.' }] }, 'Warnings', true));
  assert.equal(out.flags, MessageFlags.IsComponentsV2); assert.equal(out.content, null); assert.deepEqual(out.embeds, []);
});
test('existing V2 panels have the V2 flag repaired, never replaced by ephemeral', () => {
  const out = p.format({ ...p.panel('Test', ['Panel']), flags: 64 }, 'Test');
  assert.equal(out.flags, 32832);
});
test('legacy interactive layouts retain their controls and embed format', () => {
  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('verification:verify').setLabel('Verify').setStyle(ButtonStyle.Success));
  const out = data(p.format({ embeds: [{ title: 'Verification', description: 'Click below.' }], components: [row] }, 'Verification'));
  assert.equal(out.components[0].type, 1); assert.equal(out.components[0].components[0].custom_id, 'verification:verify');
  assert.equal(out.embeds[0].title, 'Verification'); assert.ok(out.embeds[0].footer); assert.ok(!(out.flags & MessageFlags.IsComponentsV2));
});
test('attachments are not converted into incompatible V2 replies', () => {
  const input = { content: 'Transcript', files: ['transcript.txt'] };
  assert.deepEqual(p.format(input, 'Ticket'), input);
});
test('dashboard uses a private V2 container with unique, bounded controls', () => {
  db.data.cases = Array.from({ length: 24 }, (_, id) => ({ id, guildId: 'g1', userId: 'u', modId: 'mod', type: 'warn', reason: 'Long reason '.repeat(80), at: Date.now(), points: 1 }));
  const i = { guildId: 'g1', guild: { ownerId: 'owner' }, user: { id: 'mod' }, member: staff() };
  for (const tab of ['overview', 'cases', 'warnings', 'tools', 'settings']) {
    const out = data(require('../commands/dashboard').view(i, 'all', tab));
    assert.equal(out.flags, MessageFlags.IsComponentsV2); assert.equal(out.components[0].type, 17);
    const nodes = walk(out), ids = nodes.filter(n => n.custom_id).map(n => n.custom_id);
    assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(id => id.length <= 100));
    assert.ok(nodes.length <= 40, `${tab}: ${nodes.length} components`);
    assert.ok(nodes.filter(n => n.type === 10).reduce((n, node) => n + node.content.length, 0) < 4000);
  }
});
test('dashboard prevents staff without administrator permission from opening settings', () => {
  const i = { guildId: 'g1', guild: { ownerId: 'owner' }, user: { id: 'mod' }, member: { permissions: { has: () => false }, roles: { cache: new Map([[require('../config').roles.staff, true]]) } } };
  assert.throws(() => require('../commands/dashboard').view(i, 'all', 'settings'), /administrators/);
});
test('member selector is owner-checked and changes the scope', async () => {
  const i = { guildId: 'g1', guild: { ownerId: 'owner' }, user: { id: 'mod' }, member: staff(), customId: 'dashscope:mod', values: ['u'], update: async out => assert.match(JSON.stringify(out), /<@u>/) };
  await require('../commands/dashboard').select(i);
  i.customId = 'dashscope:other'; i.reply = async out => assert.match(JSON.stringify(out), /own panel/);
  await require('../commands/dashboard').select(i);
});
test('server info contains real security/settings sections without inventing online counts', async () => {
  const roles = new Collection([['g1', { id: 'g1', position: 0 }], ['r1', { id: 'r1', position: 1 }]]);
  const channels = new Collection([['c1', { id: 'c1', type: ChannelType.GuildText, isThread: () => false }]]);
  const guild = { id: 'g1', name: 'Test Server', ownerId: 'owner', memberCount: 45, premiumTier: 1, premiumSubscriptionCount: 4, verificationLevel: 1, mfaLevel: 1, explicitContentFilter: 2, defaultMessageNotifications: 1, features: ['COMMUNITY'], createdTimestamp: Date.now(), members: { me: { joinedTimestamp: Date.now() } }, channels: { cache: channels, fetch: async () => channels }, roles: { cache: roles, fetch: async () => roles }, fetchOwner: async () => ({ id: 'owner' }), iconURL: () => 'https://cdn.discordapp.com/icons/123/icon.png' };
  guild.fetch = async () => guild;
  const out = data(await require('../commands/info').serverView({ guild })); const text = JSON.stringify(out);
  for (const label of ['Basic information', 'Security', 'Server configuration', 'Channels', 'Roles', 'Server features', 'Server ID: g1']) assert.ok(text.includes(label));
  assert.ok(!text.includes('online')); assert.ok(text.includes('Required')); assert.equal(out.components[0].components[0].type, 9);
});
test('slash-command router applies shared presentation to command replies', async () => {
  let output;
  const interaction = {
    commandName: 'purge', inGuild: () => true, isButton: () => false,
    isUserSelectMenu: () => false, isAutocomplete: () => false, isChatInputCommand: () => true,
    client: { commands: new Map([['purge', { execute: async i => i.reply({ content: 'Deleted 5 messages.', flags: 64 }) }]]) },
    reply: async payload => { output = data(payload); },
  };
  await require('../handlers/interactions')(interaction);
  assert.equal(output.flags, 32832); assert.equal(output.components[0].type, 17);
  assert.match(JSON.stringify(output), /Deleted 5 messages/);
});
