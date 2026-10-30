const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('unban', 'Unban • Laredo staff tools', b => { b.addStringOption(o => o.setName('user_id').setDescription('Banned user ID').setRequired(true)); reason(b, false); }, i => require('../utils/mod-command').execute(i, 'unban'));
