const path = require('path');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const SassPlugin = require('sass-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = [
  {
    mode: 'production',
    target: 'electron-main',
    entry: ['./src/server.ts'],
    output: {
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/',
      filename: 'server.js',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    externals : {
      nodegit: 'require("nodegit")'
    },
    module: {
      rules: [
        {
          enforce: 'pre',
          test: /\.tsx?$/,
          loaders: ['tslint-loader'],
          exclude: /node_modules/
        },
        {
          test: /\.tsx?$/,
          loaders: ['ts-loader'],
          exclude: /node_modules/,
        },
      ],
    },
    plugins: [
      new CleanWebpackPlugin([path.join('dist', '*')]),
      new CopyWebpackPlugin([{
        from: 'src/package.json.electron',
        to: 'package.json',
      }]),
      new CopyWebpackPlugin([{
        from: 'src/app/index.html',
        to: 'app/index.html',
      }]),
    ],
  },
  {
    mode: 'production',
    target: 'electron-renderer',
    devtool: 'source-map',
    entry: ['./src/app/index.tsx'],
    output: {
      path: path.resolve(__dirname, 'dist/app'),
      publicPath: '/',
      filename: 'index.js',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],
    },
    externals : {
      nodegit: 'require("nodegit")'
    },
    module: {
      rules: [
        {
          enforce: 'pre',
          test: /\.tsx?$/,
          loaders: ['tslint-loader'],
          exclude: /node_modules/
        },
        {
          test: /\.tsx?$/,
          loaders: ['ts-loader'],
          exclude: /node_modules/,
        },
        {
          test: /\.(jpe?g|png|gif|svg)$/i,
          use: [
            {
              loader: 'file-loader',
              options: {
                context: 'src',
                name: '[path][name].[ext]'
              },
            },
            {
              loader: 'image-webpack-loader'
            },
          ],
        },
        {
          test: /\.(woff|woff2|ttf|eot)$/i,
          loader: 'file-loader',
          options: {
            context: 'src',
            name: '[path][name].[ext]'
          },
        },
      ],
    },
    plugins: [
      new SassPlugin('src/app/styles/index.scss', {
        sourceMap: true,
        sass: { outputStyle: 'compressed' },
        autoprefixer: true
      }),
    ],
  }
];
