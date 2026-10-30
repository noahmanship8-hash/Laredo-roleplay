const { make } = require('../utils/command-factory');
module.exports = make('premium', 'Premium • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'premium'));
