"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
console.log("Start...");
console.log("Tauren version: 3.0.1");
console.log("Node version: " + process.version);
var npmi = require('npmi');
console.log("npm version: " + npmi.NPM_VERSION); // prints the installed npm version used by npmi
const Engine_1 = require("./Engine");
var engine = new Engine_1.default();
engine.run();
