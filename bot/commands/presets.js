const { make, user, page } = require('../utils/command-factory');
module.exports = make('presets', 'Presets • Laredo staff tools', b => { ; }, i => require('../utils/tools').execute(i, 'presets'));
