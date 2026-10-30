const { make, user, page } = require('../utils/command-factory');
module.exports = make('nick', 'Nick • Laredo staff tools', b => { user(b); b.addStringOption(o => o.setName('nickname').setDescription('New nickname; omit to clear').setMaxLength(32)); }, i => require('../utils/tools').execute(i, 'nick'));
