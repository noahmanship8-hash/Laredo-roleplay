// Tiny JSON-file "database" so you don't need to install anything extra.
// Everything the bot remembers (tickets, mod cases, session panel) lives in data/db.json.
const fs = require('node:fs');
const path = require('node:path');

const FILE = process.env.BOT_DB_PATH || path.join(__dirname, '..', 'data', 'db.json');

const defaults = () => ({
  nextCaseId: 1,
  notes: [],
  locks: {},
  logging: {},
  community: {},
  cases: [],
  tickets: {},
  suggestions: {},
  reviews: [],
  economy: { users: {}, items: {}, config: {}, tickets: {} },
  appeals: {},
  appealChannels: {},
  verification: {},
  pendingVerification: {},
  antinuke: {},
  warnings: {},
  escalation: {},
  ticketSettings: {},
  ticketCategoryRoles: {},
  session: {
    status: 'offline',
    serverName: null,
    owner: null,
    code: null,
    players: 0,
    maxPlayers: null,
    moderating: 0,
    queue: 0,
    updatedAt: null,
    channelId: null,
    messageId: null,
  },
});

let data = defaults();

try {
  const saved = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  data = { ...defaults(), ...saved, session: { ...defaults().session, ...(saved.session || {}) }, economy: { ...defaults().economy, ...(saved.economy || {}) }, appeals: saved.appeals || {}, appealChannels: saved.appealChannels || {}, verification: saved.verification || {}, pendingVerification: saved.pendingVerification || {}, antinuke: saved.antinuke || {}, warnings: saved.warnings || {}, escalation: saved.escalation || {}, ticketSettings: saved.ticketSettings || {}, ticketCategoryRoles: saved.ticketCategoryRoles || {} };
} catch (error) {
  if (error.code !== 'ENOENT') throw new Error('Cannot read moderation database; restore a valid backup before starting.', { cause: error });
}
// Legacy cases belonged to the single server configured in the original bot.
for (const record of data.cases) {
  if (!record.guildId && process.env.GUILD_ID) record.guildId = process.env.GUILD_ID;
}
data.nextCaseId = data.cases.reduce((next, c) => Math.max(next, c.id + 1), data.nextCaseId);

function save() {
  fs.mkdirSync(path.dirname(FILE), { recursive: true });
  const tmp = FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, FILE);
}

module.exports = {
  get data() {
    return data;
  },
  save,
};
