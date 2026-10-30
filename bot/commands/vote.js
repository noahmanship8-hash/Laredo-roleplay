const { make } = require('../utils/command-factory');
module.exports = make('vote', 'Vote • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'vote'));
