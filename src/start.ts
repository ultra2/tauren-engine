/// <reference path="_all.d.ts" />
"use strict";

console.log("Start...")
console.log("Tauren version: 1.0.18")
console.log("Node version: " + process.version);

import Engine from './Engine'

var engine = new Engine();
engine.run() 

var fs = require('fs-extra')
var npmi = require('npmi');
var path = require('path');

console.log("npm version: " + npmi.NPM_VERSION); // prints the installed npm version used by npmi

var path2 = '/data/projects'

console.log('delete /data/projects...')
fs.emptyDirSync(path2)

var options = {
	name: 'react-split-pane',	// your module name
//version: '3.10.9',		// expected version [default: 'latest']
	path: path2,				// installation path [default: '.']
	forceInstall: true,	// force install if set to true (even if already installed, it will do a reinstall) [default: false]
	npmLoad: {				// npm.load(options, callback): this is the "options" given to npm.load()
		loglevel: 'silent'	// [default: {loglevel: 'silent'}]
	}
};
npmi(options, function (err, result) {
	if (err) {
		if 		(err.code === npmi.LOAD_ERR) 	{
      console.log('npm load error');
      return
    }
		if (err.code === npmi.INSTALL_ERR) {
      console.log('npm install error: ' + err.message);
    }
		return console.log(err.message);
	}

	// installed
	console.log(options.name+'@'+options["version"]+' installed successfully in '+path.resolve(options.path));
});