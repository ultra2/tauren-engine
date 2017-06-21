"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fsextra = require("fs-extra");
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
        if (fileName.substring(fileName.length - 36) == "node_modules/typescript/lib/lib.d.ts") {
            console.log("fs: loaded: " + fileName);
            return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString());
        }
        if (fileName.substring(0, 13) == "/node_modules") {
            if (!fsextra.existsSync("/tmp/virtual/" + this.app.name + "/" + fileName)) {
                console.log("fs: not exists: " + "/tmp/virtual/" + this.app.name + "/" + fileName);
                return undefined;
            }
            console.log("fs: loaded: " + "/tmp/virtual/" + this.app.name + "/" + fileName);
            return ts.ScriptSnapshot.fromString(fsextra.readFileSync("/tmp/virtual/" + this.app.name + "/" + fileName).toString());
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
        return "/tmp/virtual/" + this.app.name;
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
        return ts.getDefaultLibFilePath(options);
    }
}
exports.default = LanguageServiceHost;
