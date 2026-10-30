const { make } = require('../utils/command-factory');
module.exports = make('serverinfo', 'View server information, security, roles and channels', null, i => require('./info').execute(i, 'server'));
