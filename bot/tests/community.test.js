const { test, beforeEach, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path');
const { PermissionFlagsBits: P } = require('discord.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'laredo-community-'));
process.env.BOT_DB_PATH = path.join(dir, 'db.json');
const db = require('../utils/db'); const c = require('../utils/community');
after(() => fs.rmSync(dir, { recursive: true, force: true }));
beforeEach(() => { db.data.community = {}; db.data.verification = {}; });
function member(bot = false) {
  const assigned = [];
  const role = { id: 'r1', position: 1, permissions: { has: () => false } };
  const guild = { id: 'g1', members: { me: { permissions: { has: p => p === P.ManageRoles }, roles: { highest: { position: 10 } } } }, roles: { fetch: async () => role } };
  return { assigned, role, guild, user: { bot }, roles: { cache: new Map(), add: async role => assigned.push(role.id) } };
}
test('community commands serialize', () => {
  for (const name of ['autorole', 'selfrole', 'slowmode', 'avatar']) assert.equal(require('../commands/' + name).data.toJSON().name, name);
});
test('human join roles are assigned on unverified-disabled servers', async () => {
  c.settings('g1').autoroles.push({ roleId: 'r1', target: 'humans', stage: 'join' });
  const m = member(); await c.assignAutoRoles(m); assert.deepEqual(m.assigned, ['r1']);
});
test('human join roles wait for verification when verification is enabled', async () => {
  c.settings('g1').autoroles.push({ roleId: 'r1', target: 'humans', stage: 'join' });
  db.data.verification.g1 = { enabled: true };
  const m = member(); await c.assignAutoRoles(m); assert.deepEqual(m.assigned, []);
  await c.assignAutoRoles(m, 'verified'); assert.deepEqual(m.assigned, ['r1']);
});
test('bot rules do not grant roles to human members', async () => {
  c.settings('g1').autoroles.push({ roleId: 'r1', target: 'bots', stage: 'join' });
  const human = member(); await c.assignAutoRoles(human); assert.deepEqual(human.assigned, []);
  const bot = member(true); await c.assignAutoRoles(bot); assert.deepEqual(bot.assigned, ['r1']);
});
test('verified-stage rules do not run on join', async () => {
  c.settings('g1').autoroles.push({ roleId: 'r1', target: 'humans', stage: 'verified' });
  const m = member(); await c.assignAutoRoles(m); assert.deepEqual(m.assigned, []);
});
test('disabled auto-roles perform no assignments', async () => {
  const s = c.settings('g1'); s.autoroleEnabled = false; s.autoroles.push({ roleId: 'r1', target: 'humans', stage: 'join' });
  const m = member(); await c.assignAutoRoles(m); assert.deepEqual(m.assigned, []);
});
test('privileged roles and roles above the bot are rejected', () => {
  const m = member(); m.role.permissions.has = p => p === P.Administrator;
  assert.throws(() => c.checkRole(m.guild, m.role), /privileged/);
  m.role.permissions.has = () => false; m.role.position = 10;
  assert.throws(() => c.checkRole(m.guild, m.role), /above/);
});
test('verification and staff roles cannot be self-assigned or automated', () => {
  const m = member(); db.data.verification.g1 = { verifiedRoleId: 'r1' };
  assert.throws(() => c.checkRole(m.guild, m.role), /verification roles/);
  db.data.verification = {}; m.role.id = require('../config').roles.staff;
  assert.throws(() => c.checkRole(m.guild, m.role), /Staff/);
});
test('role permissions are rechecked at assignment, not just setup', async () => {
  c.settings('g1').autoroles.push({ roleId: 'r1', target: 'humans', stage: 'join' });
  const m = member(); m.role.permissions.has = p => p === P.BanMembers;
  const results = await c.assignAutoRoles(m); assert.deepEqual(m.assigned, []); assert.equal(results[0].ok, false);
});
test('self-role command rejects roles outside the approved list', async () => {
  const m = member(); const i = { guildId: 'g1', guild: m.guild, options: { getSubcommand: () => 'join', getRole: () => m.role }, deferReply: async () => {}, editReply: async payload => assert.match(JSON.stringify(payload), /not on the optional-role list/) };
  await require('../commands/selfrole').execute(i);
});
test('unverified members cannot use optional roles to bypass verification', async () => {
  const m = member(); m.roles.cache.set('unverified', true); m.guild.members.fetch = async () => m;
  c.settings('g1').selfroles.push('r1'); db.data.verification.g1 = { enabled: true, unverifiedRoleId: 'unverified', verifiedRoleId: 'verified' };
  const i = { guildId: 'g1', guild: m.guild, user: { id: 'u1' }, options: { getSubcommand: () => 'join', getRole: () => m.role }, deferReply: async () => {}, editReply: async payload => assert.match(JSON.stringify(payload), /Complete server verification/) };
  await require('../commands/selfrole').execute(i); assert.deepEqual(m.assigned, []);
});
test('non-administrators cannot approve optional roles', async () => {
  const m = member(); const i = { guildId: 'g1', guild: m.guild, member: { permissions: { has: () => false }, roles: { cache: new Map() } }, user: { id: 'u1' }, options: { getSubcommand: () => 'allow' }, deferReply: async () => {}, editReply: async payload => assert.match(JSON.stringify(payload), /only available to server staff/) };
  await require('../commands/selfrole').execute(i); assert.deepEqual(c.settings('g1').selfroles, []);
});
