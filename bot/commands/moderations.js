const { make, user, page } = require('../utils/command-factory');
module.exports = make('moderations', 'Moderations • Laredo staff tools', b => { ; }, i => require('../utils/tools').execute(i, 'moderations'));
