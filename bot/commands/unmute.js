const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('unmute', 'Unmute • Laredo staff tools', b => { user(b); reason(b, false); }, i => require('../utils/mod-command').execute(i, 'untimeout'));
