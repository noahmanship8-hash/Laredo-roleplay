const { make, user, page } = require('../utils/command-factory');
module.exports = make('inviteinfo', 'Inviteinfo • Laredo staff tools', b => { b.addStringOption(o => o.setName('invite').setDescription('Discord invite URL or code').setRequired(true)); }, i => require('../utils/tools').execute(i, 'inviteinfo'));
