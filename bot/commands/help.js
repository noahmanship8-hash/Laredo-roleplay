const { make } = require('../utils/command-factory');
module.exports = make('help', 'Help • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'help'));
