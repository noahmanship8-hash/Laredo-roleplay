const { make } = require('../utils/command-factory');
module.exports = make('support', 'Support • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'support'));
