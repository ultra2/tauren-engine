"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
class Binding {
    constructor(_virtualfs) {
        this.virtualfs = _virtualfs;
    }
    readFileSync(path, options) {
        if (path.substring(0, 9) == "/virtual/") {
            return this.virtualfs.readFileSync(path);
        }
        else {
            return fs["realFunctions"].readFileSync(path, options);
        }
    }
}
exports.default = Binding;
