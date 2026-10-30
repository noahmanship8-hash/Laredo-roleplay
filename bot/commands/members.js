const { make, user, page } = require('../utils/command-factory');
module.exports = make('members', 'Members • Laredo staff tools', b => { b.addRoleOption(o => o.setName('include').setDescription('Must have this role')); b.addRoleOption(o => o.setName('exclude').setDescription('Must not have this role')); page(b); }, i => require('../utils/tools').execute(i, 'members'));
