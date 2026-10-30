const { make } = require('../utils/command-factory');
module.exports = make('ping', 'Ping • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'ping'));
