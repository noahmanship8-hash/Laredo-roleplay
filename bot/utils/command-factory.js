const { SlashCommandBuilder } = require('discord.js');
function make(name, description, build, execute) {
  const data = new SlashCommandBuilder().setName(name).setDescription(description).setDMPermission(false);
  if (build) build(data);
  return { data, execute };
}
const user = (b, required = true) => b.addUserOption(o => o.setName('user').setDescription('Member to look up or manage').setRequired(required));
const reason = (b, required = true) => b.addStringOption(o => o.setName('reason').setDescription('Explain the reason clearly').setMaxLength(500).setRequired(required));
const page = b => b.addIntegerOption(o => o.setName('page').setDescription('Results page').setMinValue(1));
module.exports = { make, user, reason, page };
