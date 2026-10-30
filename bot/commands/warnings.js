const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('warnings', 'Warnings • Laredo staff tools', b => { user(b); page(b); }, i => require('../utils/mod-command').execute(i, 'warnings'));
