const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('modlogs', 'View member moderation history', b => { user(b); page(b); }, i => require('../utils/mod-command').execute(i, 'history'));
