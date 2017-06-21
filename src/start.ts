/// <reference path="_all.d.ts" />
"use strict";

console.log("Start...")
console.log("Tauren version: 1.0.19")
console.log("Node version: " + process.version);

var npmi = require('npmi');
console.log("npm version: " + npmi.NPM_VERSION); // prints the installed npm version used by npmi

import Engine from './Engine'

var engine = new Engine();
engine.run() 
