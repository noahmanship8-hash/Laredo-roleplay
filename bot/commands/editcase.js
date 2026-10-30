const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('editcase', 'Edit a case reason with audit history', b => { b.addIntegerOption(o => o.setName('case').setDescription('Moderation case number').setRequired(true).setMinValue(1));reason(b);; }, i => require('../utils/mod-command').execute(i, 'editcase'));
