const { make, user, page } = require('../utils/command-factory');
module.exports = make('modstats', 'Modstats • Laredo staff tools', b => { user(b, false); }, i => require('../utils/tools').execute(i, 'modstats'));
