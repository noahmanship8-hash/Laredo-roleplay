const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('kick', 'Kick • Laredo staff tools', b => { user(b); reason(b); }, i => require('../utils/mod-command').execute(i, 'kick'));
