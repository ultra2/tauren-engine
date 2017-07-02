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
        if (fileName.substring(fileName.length - 36) == "node_modules/typescript/lib/lib.d.ts") {
            return "";
        }
        return this.app.getScriptVersion(fileName);
    }
    getScriptSnapshot(fileName) {
        if (fileName.substring(fileName.length - 36) == "node_modules/typescript/lib/lib.d.ts") {
            return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString());
        }
        if (!this.app.isFileExists(fileName)) {
            return undefined;
        }
        return ts.ScriptSnapshot.fromString(this.app.loadFile(fileName).buffer.toString());
    }
    getCurrentDirectory() {
        return "";
    }
    getCompilationSettings() {
        var path = '/config/tsconfig.json';
        if (this.app.isFileExists(path)) {
            var tsconfig = this.app.loadFile(path).buffer.toString();
            var result = JSON.parse(tsconfig);
            return result;
        }
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
