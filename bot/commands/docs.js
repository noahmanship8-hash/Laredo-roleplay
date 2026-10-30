const { make } = require('../utils/command-factory');
module.exports = make('docs', 'Docs • Laredo Roleplay', null, i => require('../utils/information').execute(i, 'docs'));
