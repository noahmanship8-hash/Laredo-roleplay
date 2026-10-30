const { make } = require('../utils/command-factory');
module.exports = make('status', 'Status • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'status'));
