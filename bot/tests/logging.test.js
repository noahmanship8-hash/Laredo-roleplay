const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { Events } = require('discord.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laredo-logs-'));
process.env.BOT_DB_PATH = path.join(dir, 'db.json');
const db = require('../utils/db'); const logs = require('../utils/server-logs');
after(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { db.data.logging = {}; });
function setup(category) {
  const handlers = new Map(), sent = [];
  logs.install({ on: (name, handler) => handlers.set(name, handler) });
  const guild = { id: 'g1', channels: { fetch: async () => ({ isTextBased: () => true, send: async payload => { sent.push(payload); } }) } };
  db.data.logging.g1 = { [category]: 'logs' };
  return { handlers, sent, guild };
}
test('logging config exposes valid command schema', () => {
  const schema = require('../commands/logging').data.toJSON();
  assert.equal(schema.name, 'logging'); assert.equal(schema.options.length, 4);
});
test('logging is disabled until a server category is configured', async () => {
  let fetched = false;
  await logs.send({ id: 'g2', channels: { fetch: async () => { fetched = true; } } }, 'messages', 'delete', 'Delete', 'Example');
  assert.equal(fetched, false);
});
test('deleted messages are red, include content, and never ping', async () => {
  const { handlers, sent, guild } = setup('messages');
  await handlers.get(Events.MessageDelete)({ guild, id: 'm1', channelId: 'c1', content: '@everyone test', author: { id: 'u1', username: 'User' } });
  assert.equal(sent.length, 1); const embed = sent[0].embeds[0].toJSON();
  assert.equal(embed.color, logs.colors.delete); assert.match(JSON.stringify(embed), /@everyone test/);
  assert.deepEqual(sent[0].allowedMentions, { parse: [] });
});
test('uncached deleted messages explain unavailable content', async () => {
  const { handlers, sent, guild } = setup('messages');
  await handlers.get(Events.MessageDelete)({ guild, id: 'm1', channelId: 'c1' });
  assert.match(JSON.stringify(sent[0]), /cannot be recovered/);
});
test('log-channel deletions and bot messages cannot create logging loops', async () => {
  const { handlers, sent, guild } = setup('messages');
  await handlers.get(Events.MessageDelete)({ guild, channelId: 'logs', content: 'Log' });
  await handlers.get(Events.MessageDelete)({ guild, channelId: 'c1', author: { bot: true } });
  assert.equal(sent.length, 0);
});
test('voice moves show both channels and blue colour', async () => {
  const { handlers, sent, guild } = setup('voice');
  await handlers.get(Events.VoiceStateUpdate)({ channelId: 'a', channel: { id: 'a', name: 'Old' } }, { guild, id: 'u', channelId: 'b', channel: { id: 'b', name: 'New', members: { size: 2 } }, member: { user: { id: 'u', username: 'User' } } });
  assert.equal(sent[0].embeds[0].toJSON().color, logs.colors.move); assert.match(JSON.stringify(sent), /Old/); assert.match(JSON.stringify(sent), /New/);
});
test('role colour changes are recorded', async () => {
  const { handlers, sent, guild } = setup('roles');
  await handlers.get(Events.GuildRoleUpdate)({ hexColor: '#111111', permissions: { bitfield: 0n } }, { guild, id: 'role', hexColor: '#222222', permissions: { bitfield: 0n } });
  assert.match(JSON.stringify(sent), /#111111/); assert.match(JSON.stringify(sent), /#222222/);
});
