#!/usr/bin/env node
"use strict";
const download = require('download-git-repo');
const { version } = require('../package.json');
console.log(`Downloading and extracting Substrait version ${version}`);
download(`substrait-io/substrait#v${version}`, 'substrait-download', {}, function (err) {
    if (err) {
        console.log('An error occurred downloading the Substrait repo:');
        console.log();
        console.log(err);
    }
});
