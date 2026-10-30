const { make, user, page } = require('../utils/command-factory');
module.exports = make('clean', 'Clean • Laredo staff tools', b => { b.addIntegerOption(o => o.setName('amount').setDescription('Maximum bot messages to remove from the last 100').setMinValue(1).setMaxValue(100)); }, i => require('../utils/tools').execute(i, 'clean'));
