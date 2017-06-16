"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
class LanguageServiceHost {
    constructor(_app) {
        this.app = _app;
    }
    getScriptFileNames() {
        return ['/virtual/' + this.app.name + "/main.ts"];
    }
    getScriptVersion(fileName) {
        return this.app.pathversions[fileName] && this.app.pathversions[fileName].version.toString();
    }
    getScriptSnapshot(fileName) {
        console.log("getScriptSnapshot", fileName);
        if (!fs.existsSync(fileName)) {
            return undefined;
        }
        return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    }
    getCurrentDirectory() {
        return '/virtual/' + this.app;
    }
    getCompilationSettings() {
        return {
            outFile: "dist/main-all.js",
            noEmitOnError: true,
            noImplicitAny: true,
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.AMD
        };
    }
    getDefaultLibFileName(options) {
        return ts.getDefaultLibFilePath(options);
    }
}
exports.default = LanguageServiceHost;
