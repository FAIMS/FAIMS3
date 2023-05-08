const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshPlugin=require('react-refresh')

module.exports = {
  // stats: {
  //   // Configure the console output
  //   errorDetails: true, //this does show errors
  //   colors: false,
  //   modules: true,
  //   reasons: true,
  // },
  entry: './src/index.tsx',
  output: {
    path: path.join(__dirname, '/dist'), // the bundle output path
    filename: 'bundle.js', // the name of the bundle
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/index.html', // to import index.html file inside index.js
    }),new ReactRefreshPlugin({})
  ],
  devServer: {
    port: 3030, // you can change the port
  },
  module: {
    rules: [
      {
        test: /\.(ts|tsx)$/, // .js and .jsx files
        exclude: /node_modules/, // excluding the node_modules folder
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },
};
