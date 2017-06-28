"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fsextra = require("fs-extra");
class LanguageServiceHost {
    constructor(_app) {
        this.app = _app;
    }
    getScriptFileNames() {
        return ["main.tsx"];
    }
    getScriptVersion(fileName) {
        var file = this.app.findFile(fileName);
        if (!file)
            return "0";
        if (!file.metadata)
            return "0";
        if (!file.metadata.version)
            return "0";
        return file.metadata.version.toString();
    }
    getScriptSnapshot(fileName) {
        console.log("getScriptSnapshot", fileName);
        if (fileName.substring(fileName.length - 36) == "node_modules/typescript/lib/lib.d.ts") {
            console.log("fs: loaded: " + fileName);
            return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString());
        }
        if (!this.app.isFileExists(fileName)) {
            console.log("fs: not exists: " + fileName);
            return undefined;
        }
        console.log("fs: loaded: " + fileName);
        return ts.ScriptSnapshot.fromString(this.app.loadFile2(fileName).toString());
    }
    getCurrentDirectory() {
        return "";
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
