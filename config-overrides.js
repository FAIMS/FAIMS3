const { override, removeInternalBabelPlugin } = require('customize-cra');

module.exports = function override(config, env) {
    config = removeInternalBabelPlugin('@babel/plugin-transform-async-to-generator')(config, env);
    config.optimization.minimize = false;
    return config;
}
