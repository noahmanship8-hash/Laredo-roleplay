const { make, user } = require('../utils/command-factory');
const m = require('../utils/moderation');
module.exports = make('avatar', 'View your own or another member’s avatar', b => user(b, false), async i => {
  const user = i.options.getUser('user') || i.user;
  const url = user.displayAvatarURL({ size: 1024 });
  const embed = m.card(`${user.username} · Avatar`, `[Open full-size avatar](${url})`).setImage(url).setFooter({ text: 'Laredo Roleplay • Community tools' });
  return i.reply({ embeds: [embed], allowedMentions: { parse: [] }, flags: 64 });
});
