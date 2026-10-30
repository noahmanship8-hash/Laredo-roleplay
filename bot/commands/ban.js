const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('ban', 'Ban • Laredo staff tools', b => { user(b); reason(b); }, i => require('../utils/mod-command').execute(i, 'ban'));
