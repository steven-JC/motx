'use strict'

const webpack = require('webpack')
const path = require('path')

const HtmlWebpackPlugin = require('html-webpack-plugin')
const { VueLoaderPlugin } = require('vue-loader')

module.exports = {
    devtool: '#cheap-module-eval-source-map',
    entry: {
        index: path.join(__dirname, '../src/demo/index.ts')
    },
    output: {
        filename: '[name].js?[hash]',
        path: path.join(__dirname, '../dist')
    },
    resolve: {
        alias: {
            vue$: 'vue/dist/vue.esm.js'
        },
        extensions: ['.js', '.ts', '.vue']
    },
    devServer: {
        host: 'localhost',
        port: 8071
    },
    plugins: [
        new VueLoaderPlugin(),
        new HtmlWebpackPlugin({
            filename: 'index.html',
            template: path.resolve(__dirname, '../src/demo/index.html')
        }),
        new webpack.DefinePlugin({
            'process.env.IS_WEB': 'true'
        }),
        new webpack.HotModuleReplacementPlugin(),
        new webpack.NoEmitOnErrorsPlugin()
    ],

    module: {
        rules: [
            {
                test: /\.html$/,
                use: 'vue-html-loader'
            },
            {
                test: /\.js$/,
                use: 'babel-loader',
                include: [path.resolve(__dirname, '../src')],
                exclude: /node_modules/
            },

            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
                options: {
                    appendTsSuffixTo: [/\.vue$/],
                    transpileOnly: true
                }
            },
            {
                test: /\.vue$/,
                use: {
                    loader: 'vue-loader'
                }
            }
        ]
    },

    target: 'web'
}
