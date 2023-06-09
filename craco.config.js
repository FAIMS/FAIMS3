const path = require('path');
const resolve = require('resolve');
const webpack = require('webpack');

module.exports = {
  jest: {
    babel: {
      addPresets: true /* (default value) */,
      addPlugins: true /* (default value) */,
    },
    configure: (jestConfig, { env, paths, resolve, rootDir }) => {
      /* ... */
      return jestConfig;
    },
  },
  webpack: {
    configure: (webpackConfig, {env, paths}) => {
      // Replace the babel-loader rule with a rule for ts-loader
      webpackConfig.module.rules.push({
        test: /\.(ts|tsx)$/,
        include: paths.appSrc,
        loader: require.resolve('ts-loader'),
        options: {
          transpileOnly: true,
        },
      });

      webpackConfig.plugins.forEach(plugin => {
        if (plugin.config?.maximumFileSizeToCacheInBytes) {
          plugin.config.maximumFileSizeToCacheInBytes = 10 * 1024 * 1024;
        }
      });

      // Add the .ts and .tsx extensions to resolve.extensions
      webpackConfig.resolve.extensions.push('.ts', '.tsx');

      // Alias the 'util' module
      webpackConfig.resolve.alias = {
        ...webpackConfig.resolve.alias,
        util: require.resolve('util/'),
        assert: require.resolve('assert/'),
        stream: require.resolve('stream/'),
      };

      // Add a plugin to replace the 'process' variable
      webpackConfig.plugins.push(
        new webpack.ProvidePlugin({
          process: 'process/browser',
        }),
        new webpack.ProvidePlugin({
          Buffer: ['buffer', 'Buffer'],
        }),
      );

      return webpackConfig;
    },
  },
};
