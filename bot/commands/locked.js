const { make, user, page } = require('../utils/command-factory');
module.exports = make('locked', 'Locked • Laredo staff tools', b => { ; }, i => require('../utils/tools').execute(i, 'locked'));
