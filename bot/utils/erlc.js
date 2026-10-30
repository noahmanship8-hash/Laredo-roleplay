// OPTIONAL: pulls live numbers from the ER:LC private-server API (needs the "API" server pack).
// Only used if ERLC_SERVER_KEY is set in your .env - otherwise everything is entered by hand.
// ER:LC retired api.policeroleplay.community. The current API is v2 on api.erlc.gg.
const BASE = 'https://api.erlc.gg/v2';

const enabled = () => Boolean(process.env.ERLC_SERVER_KEY);

async function call(path) {
  const res = await fetch(BASE + path, { headers: { 'server-key': process.env.ERLC_SERVER_KEY } });
  if (!res.ok) throw new Error(`ER:LC API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json();
}

async function getStats() {
  // v2 includes optional details on the server endpoint via query parameters.
  const server = await call('/server?Players=true&Queue=true');
  const list = Array.isArray(server.Players) ? server.Players : [];
  // anyone whose in-game permission is not a normal player counts as "moderating"
  const staff = list.filter((p) => p.Permission && !['Normal', 'Member'].includes(p.Permission)).length;
  return {
    serverName: server.Name,
    code: server.JoinKey,
    players: server.CurrentPlayers,
    maxPlayers: server.MaxPlayers,
    moderating: staff,
    // The API returns the queue entries when Queue=true; tolerate a numeric count too.
    queue: Array.isArray(server.Queue) ? server.Queue.length : Number(server.Queue) || 0,
  };
}

module.exports = { enabled, getStats };
