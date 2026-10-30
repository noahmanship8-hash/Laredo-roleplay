// Run this ONCE (and again whenever you add/change a command):  npm run deploy
// It tells Discord which slash commands your bot has.
require('dotenv').config();
const fs = require('node:fs');
const path = require('node:path');
const { REST, Routes } = require('discord.js');

const { DISCORD_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !CLIENT_ID || !GUILD_ID) {
  console.error('Your .env needs DISCORD_TOKEN, CLIENT_ID and GUILD_ID filled in.');
  process.exit(1);
}

const commandsDir = path.join(__dirname, 'commands');
const body = fs
  .readdirSync(commandsDir)
  .filter((f) => f.endsWith('.js'))
  .map((f) => require(path.join(commandsDir, f)).data.toJSON());

const rest = new REST().setToken(DISCORD_TOKEN);

(async () => {
  try {
    console.log(`Registering ${body.length} commands...`);
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body });
    console.log('Done! The commands should show up in your server straight away.');
  } catch (err) {
    console.error('Failed to register commands:', err);
    process.exitCode = 1;
  }
})();
