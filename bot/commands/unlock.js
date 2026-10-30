const { make, user, page } = require('../utils/command-factory');
module.exports = make('unlock', 'Unlock • Laredo staff tools', b => { b.addChannelOption(o => o.setName('channel').setDescription('Channel to unlock')); }, i => require('../utils/tools').execute(i, 'unlock'));
