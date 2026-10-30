const { make, user } = require('../utils/command-factory');
module.exports = make('userinfo', 'View a member profile and staff moderation summary', b => user(b, false), i => require('./info').execute(i, 'user'));
