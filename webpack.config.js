const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');

module.exports = (env, argv) => {
  const isProduction = argv.mode === 'production';

  return {
    entry: {
      popup: './src/popup/index.tsx',
      history: './src/history/index.tsx',
      background: './src/background/index.ts',
      content: './src/content/index.ts'
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].js',
      clean: true
    },
    module: {
      rules: [
        {
          test: /\.(ts|tsx)$/,
          use: {
            loader: 'ts-loader',
          },
          exclude: /node_modules/
        },
        {
          test: /\.svg$/,
          use: ['@svgr/webpack'], // SVG를 React 컴포넌트로 변환
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/popup/index.html',
        filename: 'popup.html',
        chunks: ['popup'],
        meta: {
          charset: 'UTF-8'
        }
      }),
      new HtmlWebpackPlugin({
        template: './src/history/index.html',
        filename: 'history.html',
        chunks: ['history'],
        inject: true,
        meta: {
          charset: 'UTF-8'
        }
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: 'public', to: '.' },
          { from: 'manifest.json', to: '.' }
        ]
      }),
      new webpack.DefinePlugin({
        'process.env.NODE_ENV': JSON.stringify(isProduction ? 'production' : 'development')
      })
    ],
    devtool: isProduction ? false : 'inline-source-map',
    performance: {
      hints: false
    },
    mode: isProduction ? 'production' : 'development'
  };
}; 