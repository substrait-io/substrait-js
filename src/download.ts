#!/usr/bin/env node

import { download } from 'download-git-repo';

import { version } from '../package.json';

console.log(`Downloading and extracting Substrait version ${version}`);

download(`substrait-io/substrait#v${version}`, 'substrait-spec', {}, function (err) {
    if (err) {
        console.log('An error occurred downloading the Substrait repo:');
        console.log();
        console.log(err);
    }
});
