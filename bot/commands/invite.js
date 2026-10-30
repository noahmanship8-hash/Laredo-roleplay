const { make } = require('../utils/command-factory');
module.exports = make('invite', 'Invite • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'invite'));
