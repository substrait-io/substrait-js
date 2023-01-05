var path = require("path");
var resolve = require("path").resolve;
var webpack = require("webpack");

module.exports = {
  entry: {
    demo: "./src/demo.js",
    lib: "./src/lib.js",
  },
  devtool: "inline-source-map",
  devServer: {
    hot: true,
    static: "./demo",
  },
  output: {
    path: path.join(__dirname, "dist"),
    filename: "[name].bundle.js",
  },
  mode: "development",
  module: {
    rules: [
      {
        test: /\.scss$/i,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
    ],
  },
  performance: {
    hints: false,
  },
  plugins: [],
};
