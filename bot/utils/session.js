const db = require('./db');
const ui = require('./ui');
const erlc = require('./erlc');

// Re-draws the live session panel (the message posted by /panel type:session)
async function refreshPanel(client) {
  const { channelId, messageId } = db.data.session;
  if (!channelId || !messageId) return false;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  const message = channel ? await channel.messages.fetch(messageId).catch(() => null) : null;
  if (!message) return false;
  await message.edit(ui.asMessage(ui.sessionPanel(db.data.session)));
  return true;
}

// Fills in the session numbers from ER:LC (only if a key is set). Returns true on success.
async function pullFromErlc() {
  if (!erlc.enabled()) return false;
  try {
    const stats = await erlc.getStats();
    Object.assign(db.data.session, stats, { updatedAt: Date.now() });
    db.save();
    return true;
  } catch (err) {
    console.error('[ER:LC]', err.message);
    return false;
  }
}

// While a session is online and ER:LC is connected, refresh the panel every minute.
function startAutoRefresh(client) {
  if (!erlc.enabled()) {
    console.warn('[session] ER:LC API key not configured.');
    return;
  }

  let updating = false;

  const update = async () => {
    if (updating) return;
    updating = true;

    try {
      const success = await pullFromErlc();

      if (success) {
        await refreshPanel(client);
      }
    } catch (err) {
      console.error('[session auto-refresh]', err);
    } finally {
      updating = false;
    }
  };

  // Fetch stats immediately when the bot starts.
  update();

  // Keep the panel updated every minute.
  setInterval(update, 60_000);
}

module.exports = {
  refreshPanel,
  pullFromErlc,
  startAutoRefresh
};
