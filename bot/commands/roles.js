const { make, user, page } = require('../utils/command-factory');
module.exports = make('roles', 'Roles • Laredo staff tools', b => { user(b, false); b.addStringOption(o => o.setName('search').setDescription('Role name contains')); page(b); }, i => require('../utils/tools').execute(i, 'roles'));
