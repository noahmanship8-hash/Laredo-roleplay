const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('case', 'Case • Laredo staff tools', b => { b.addIntegerOption(o => o.setName('case').setDescription('Moderation case number').setRequired(true).setMinValue(1));; }, i => require('../utils/mod-command').execute(i, 'case'));
