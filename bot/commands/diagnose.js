const { make, user, page } = require('../utils/command-factory');
module.exports = make('diagnose', 'Diagnose • Laredo staff tools', b => { ; }, i => require('../utils/tools').execute(i, 'diagnose'));
