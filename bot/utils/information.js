const m = require('./moderation');
const config = require('../config');
async function execute(i, name) {
  const texts = {
    help: '**Staff workspace**\n/dashboard · /serverinfo · /userinfo · /diagnose\n\n**Moderation & records**\n/warn · /warnings · /mute · /unmute · /kick · /ban · /unban\n/case · /editcase · /modlogs · /points · /note · /notes · /modstats\n\n**Roles & community**\n/role · /roles · /members · /selfrole · /avatar\n\n**Channels & setup**\n/lock · /unlock · /locked · /slowmode · /purge · /clean\n/logging · /autorole · /verification · /mod escalation · /staffwarn\n\n**Roleplay & support**\n/session · /panel · /ticket · /ticketconfig · /appeal · /appeals\n/suggest · /staffreview · /reviewstats · /announce\n\n**Economy & games**\n/economy · /gamble\n\n**Bot information**\n/docs · /info · /ping · /status · /invite · /support\n\n-# Staff-only commands remain permission-checked. Start with /dashboard for moderation or /selfrole list for optional roles.',
    docs: '**Quick start**\n1. Open /dashboard to review records.\n2. Use /warn with a member and clear reason.\n3. Use /case to look up a case number.\n4. Use /mod remove to void an incorrect case without deleting its history.\n5. Administrators can configure /mod escalation.\n\nFull installation and command guide: bot/README.md in this project.',
    ping: `Gateway latency: **${Math.round(i.client.ws.ping)} ms**`,
    status: `**Bot:** Connected\n**Uptime:** ${Math.floor(process.uptime()/60)} minutes\n**Discord service status:** https://discordstatus.com\nThe external status page has not been queried by this command.`,
    invite: `Invite this bot with minimal permissions, then grant only those needed by enabled features:\nhttps://discord.com/oauth2/authorize?client_id=${i.client.user.id}&permissions=0&scope=bot%20applications.commands`,
    support: config.links.website ? `Contact your server management team.\nServer website: ${config.links.website}` : 'Contact your server management team for support.',
    premium: 'This is your community bot. No Circle subscription, premium entitlement or billing integration is included.',
    vote: 'No bot-list voting page is configured for this bot. Contact server management for community links.',
  };
  return i.reply({ ...m.payload(`${config.name} · ${name}`, texts[name]), flags: 64 });
}
module.exports = { execute };
