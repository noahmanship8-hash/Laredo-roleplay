const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { PermissionFlagsBits: P } = require('discord.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laredo-bot-'));
process.env.BOT_DB_PATH = path.join(dir, 'db.json');
const db = require('../utils/db'); const m = require('../utils/moderation');
after(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { db.data.cases = []; db.data.nextCaseId = 1; db.data.escalation = {}; });
function interaction(perms = [P.Administrator]) {
  const member = { id: 'mod', permissions: { has: p => perms.includes(P.Administrator) || perms.includes(p) }, roles: { highest: { position: 10 }, cache: new Map([[require('../config').roles.staff, true]]) } };
  const target = { id: 'target', roles: { highest: { position: 1 } }, timeout: async () => {}, kick: async () => {} };
  return { guildId: 'g1', user: { id: 'mod' }, member, client: { user: { id: 'bot' } }, guild: { id: 'g1', ownerId: 'owner', members: { me: { permissions: { has: () => true }, roles: { highest: { position: 20 } } }, fetch: async () => target, ban: async () => {} }, channels: { fetch: async () => null } } };
}
test('all command definitions serialize and names are unique', () => {
  const names = new Set();
  for (const file of fs.readdirSync(path.join(__dirname, '../commands'))) {
    const command = require('../commands/' + file); const json = command.data.toJSON();
    assert.equal(typeof command.execute, 'function'); assert.ok(!names.has(json.name)); names.add(json.name);
  }
  assert.ok(names.size >= 50);
});
test('case queries isolate servers and removed cases', () => {
  db.data.cases.push({ guildId: 'g1', userId: 'u', type: 'warn' }, { guildId: 'g2', userId: 'u', type: 'warn' }, { guildId: 'g1', userId: 'u', type: 'warn', removed: true });
  assert.equal(m.active('g1', 'u', 'warn').length, 1);
});
test('staff role alone cannot perform Discord privileged actions', () => {
  assert.throws(() => m.authorize(interaction([]), P.BanMembers), /permission/);
  assert.throws(() => m.authorize(interaction([]), null, true), /administrators/);
});
test('warnings persist even when DMs are closed', async () => {
  const text = await m.punish(interaction(), 'warn', { id: 'target', send: async () => { throw Error('closed'); } }, 'Test warning');
  assert.match(text, /Unavailable/); assert.equal(m.active('g1', 'target', 'warn').length, 1);
  assert.equal(JSON.parse(fs.readFileSync(process.env.BOT_DB_PATH)).cases.length, 1);
});
test('successful escalation creates its own punishment case', async () => {
  db.data.escalation.g1 = { enabled: true, timeoutAt: 1, timeoutMinutes: 5, banAt: 3 };
  await m.punish(interaction(), 'warn', { id: 'target', send: async () => {} }, 'Test');
  assert.deepEqual(db.data.cases.map(c => c.type), ['warn', 'timeout']);
  assert.ok(db.data.cases[1].expiresAt > Date.now());
});
test('failed escalation is reported without a false punishment case', async () => {
  db.data.escalation.g1 = { enabled: true, timeoutAt: 1, timeoutMinutes: 5 };
  const text = await m.punish(interaction([]), 'warn', { id: 'target', send: async () => {} }, 'Test');
  assert.match(text, /escalation failed/); assert.equal(db.data.cases.length, 1);
});
test('self-targeting is rejected', async () => {
  await assert.rejects(m.punish(interaction(), 'warn', { id: 'mod' }, 'Test'), /cannot target/);
});
test('dashboard excludes confidential staff warnings', async () => {
  db.data.cases.push({ guildId: 'g1', userId: 'target', type: 'staffwarn', reason: 'SECRET', at: Date.now() });
  const i = interaction(); i.options = { getUser: () => null }; i.reply = async payload => { assert.ok(!JSON.stringify(payload).includes('SECRET')); assert.equal(payload.flags, 64); };
  await require('../commands/dashboard').execute(i);
});
test('dashboard buttons reject another user', async () => {
  const i = interaction(); i.customId = 'dash:someone:all:overview:1'; i.reply = async payload => assert.match(JSON.stringify(payload), /own panel/);
  await require('../commands/dashboard').button(i);
});
test('corrupt databases fail closed instead of resetting cases', () => {
  const bad = path.join(dir, 'bad.json'); fs.writeFileSync(bad, '{broken');
  const result = require('node:child_process').spawnSync(process.execPath, ['-e', "require('./utils/db')"], { cwd: path.join(__dirname, '..'), env: { ...process.env, BOT_DB_PATH: bad }, encoding: 'utf8' });
  assert.notEqual(result.status, 0); assert.match(result.stderr, /Cannot read moderation database/);
});
test('higher-ranked targets cannot be punished', async () => {
  const i = interaction(); i.guild.members.fetch = async () => ({ id: 'target', roles: { highest: { position: 15 } } });
  await assert.rejects(m.punish(i, 'warn', { id: 'target' }, 'Test'), /higher role/);
  assert.equal(db.data.cases.length, 0);
});
test('unlock restores an unset overwrite and removes the saved lock', async () => {
  const entry = { guildId: 'g1', channelId: 'c1', before: null };
  db.data.locks['g1:c1'] = entry;
  let received;
  await require('../utils/channel-locks').restore({ id: 'g1', roles: { everyone: {} }, channels: { fetch: async () => ({ permissionOverwrites: { edit: async (_role, value) => { received = value; } } }) } }, entry);
  assert.deepEqual(received, { SendMessages: null }); assert.equal(db.data.locks['g1:c1'], undefined);
});
test('failed unlock retains state for retry', async () => {
  const entry = { guildId: 'g1', channelId: 'c2', before: true };
  db.data.locks['g1:c2'] = entry;
  await assert.rejects(require('../utils/channel-locks').restore({ id: 'g1', channels: { fetch: async () => { throw Error('Missing permissions'); } } }, entry), /Missing permissions/);
  assert.equal(db.data.locks['g1:c2'], entry);
});
test('dashboard tabs and pagination always have unique button IDs', async () => {
  for (const count of [0, 3, 20]) {
    db.data.cases = Array.from({ length: count }, (_, index) => ({ id: index + 1, guildId: 'g1', userId: 'target', type: 'warn', reason: 'Test', at: Date.now() }));
    for (const tab of ['cases', 'warnings']) {
      for (const page of [1, 2, 3]) {
        const i = interaction(); i.customId = `dash:mod:all:${tab}:${page}`;
        i.update = async payload => {
          const rows = payload.components.map(row => row.toJSON());
          const ids = rows.flatMap(row => row.components.map(button => button.custom_id));
          assert.equal(new Set(ids).size, ids.length);
          if (page === 1) assert.equal(rows[1].components[0].disabled, true);
          if (count <= 8) assert.equal(rows[1].components[1].disabled, true);
        };
        i.reply = async payload => assert.fail(JSON.stringify(payload));
        await require('../commands/dashboard').button(i);
      }
    }
  }
});
test('nickname command permits self-targeting below the bot role', async () => {
  const i = interaction(); let nickname;
  i.guild.members.fetch = async () => ({ id: 'mod', roles: i.member.roles, setNickname: async value => { nickname = value; } });
  i.options = { getUser: () => ({ id: 'mod' }), getString: () => 'New name' };
  i.deferReply = async () => {}; i.editReply = async payload => assert.match(JSON.stringify(payload), /Nickname updated/);
  await require('../utils/tools').execute(i, 'nick'); assert.equal(nickname, 'New name');
});
test('nickname command explains Discord server-owner restriction', async () => {
  const i = interaction(); i.guild.ownerId = 'mod';
  i.guild.members.fetch = async () => ({ id: 'mod', setNickname: async () => assert.fail('Must not call Discord') });
  i.options = { getUser: () => ({ id: 'mod' }), getString: () => 'New name' };
  i.deferReply = async () => {}; i.editReply = async payload => assert.match(JSON.stringify(payload), /server owner/);
  await require('../utils/tools').execute(i, 'nick');
});
