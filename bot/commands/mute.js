const { make, user, reason, page } = require('../utils/command-factory');
module.exports = make('mute', 'Timeout a member', b => { user(b); b.addIntegerOption(o => o.setName('minutes').setDescription('Timeout duration in minutes').setRequired(true).setMinValue(1).setMaxValue(40320)); reason(b); }, i => require('../utils/mod-command').execute(i, 'timeout'));
