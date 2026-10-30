// WHY THIS EXISTS
// When Discord rejects a request (for example a panel it doesn't like), the discord.js REST
// library tries to turn Discord's reply into a readable message. For some replies that
// formatting step itself crashes with "TypeError: Reflect.has called on non-object", which
// hides what Discord actually said. This wraps that step so the real reply is shown instead.
//
// Put this file in your bot's  utils  folder.

function patch(DiscordAPIError) {
  if (!DiscordAPIError || typeof DiscordAPIError.getMessage !== 'function' || DiscordAPIError.__patched) {
    return false;
  }
  const original = DiscordAPIError.getMessage;
  DiscordAPIError.getMessage = function (rawError) {
    try {
      return original.call(this, rawError);
    } catch {
      let raw;
      try {
        raw = JSON.stringify(rawError);
      } catch {
        raw = String(rawError);
      }
      return `Discord rejected a request (its error details could not be formatted). Raw reply: ${String(raw).slice(0, 1800)}`;
    }
  };
  DiscordAPIError.__patched = true;
  return true;
}

function install() {
  try {
    return patch(require('@discordjs/rest').DiscordAPIError);
  } catch {
    return false;
  }
}

module.exports = { install, patch };
