"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
class LanguageServiceHost {
    constructor(_app) {
        this.app = _app;
    }
    getScriptFileNames() {
        return ['/virtual/' + this.app.name + "/main.tsx"];
    }
    getScriptVersion(fileName) {
        return this.app.pathversions[fileName] && this.app.pathversions[fileName].version.toString();
    }
    getScriptSnapshot(fileName) {
        console.log("getScriptSnapshot", fileName);
        if (fileName.substring(0, 13) == "/node_modules") {
            fileName = __dirname.substring(0, __dirname.length - 5) + fileName;
            if (!fs.existsSync(fileName)) {
                console.log("fs: not exists: " + fileName);
                return undefined;
            }
            console.log("fs: loaded: " + fileName);
            return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
        }
        if (fileName.substring(0, 8) == "/virtual") {
            fileName = fileName.substring(8);
            if (!this.app.engine.cache.existsSync(fileName)) {
                console.log("cache: not exists: " + fileName);
                return undefined;
            }
            console.log("cache: loaded: " + fileName);
            return ts.ScriptSnapshot.fromString(this.app.engine.cache.readFileSync(fileName).toString());
        }
        console.log("not exists");
        return undefined;
    }
    getCurrentDirectory() {
        return __dirname;
    }
    getCompilationSettings() {
        return {
            outFile: "dist/main-all.js",
            noEmitOnError: true,
            noImplicitAny: false,
            target: ts.ScriptTarget.ES5,
            module: ts.ModuleKind.AMD,
            jsx: ts.JsxEmit.React
        };
    }
    getDefaultLibFileName(options) {
        return "/node_modules/typescript/lib/" + ts.getDefaultLibFileName(options);
    }
}
exports.default = LanguageServiceHost;
