"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log("Start...");
console.log("Tauren version: 1.0.18");
console.log("Node version: " + process.version);
const Engine_1 = require("./Engine");
var engine = new Engine_1.default();
engine.run();
var fs = require('fs-extra');
var npmi = require('npmi');
var path = require('path');
console.log("npm version: " + npmi.NPM_VERSION);
var path2 = '/data/projects';
console.log('delete /data/projects...');
fs.emptyDirSync(path2);
var options = {
    name: 'react-split-pane',
    path: path2,
    forceInstall: true,
    npmLoad: {
        loglevel: 'silent'
    }
};
npmi(options, function (err, result) {
    if (err) {
        if (err.code === npmi.LOAD_ERR) {
            console.log('npm load error');
            return;
        }
        if (err.code === npmi.INSTALL_ERR) {
            console.log('npm install error: ' + err.message);
        }
        return console.log(err.message);
    }
    console.log(options.name + '@' + options["version"] + ' installed successfully in ' + path.resolve(options.path));
});
