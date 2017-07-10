"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pathhelper = require("path");
const ts = require("typescript");
class LanguageServiceHost {
    constructor(_app, _mode) {
        this.app = _app;
        this.mode = _mode;
    }
    getScriptFileNames() {
        return ["main/main.tsx"];
    }
    getScriptVersion(path) {
        console.log("getScriptVersion orig: " + path);
        if (path.indexOf("node_modules") == -1) {
            var parsed = pathhelper.parse(path);
            path = (this.mode == 'server') ? parsed.dir + '/' + parsed.name + '.server.ts' : path;
        }
        console.log("getScriptVersion: " + path);
        return this.app.getScriptVersion(path);
    }
    getScriptSnapshot(fileName) {
        if (!this.fileExists(fileName))
            return undefined;
        var source = this.readFile(fileName);
        return ts.ScriptSnapshot.fromString(source);
    }
    getCurrentDirectory() {
        return ".";
    }
    getCompilationSettings() {
        var path = '/config/tsconfig-' + this.mode + '.json';
        if (this.app.isFileExists(path)) {
            var tsconfig = this.app.loadFile(path).buffer.toString();
            var result = JSON.parse(tsconfig);
            return result;
        }
    }
    getDefaultLibFileName(options) {
        return "node_modules/typescript/lib/" + ts.getDefaultLibFileName(options);
    }
    readFile(path, encoding) {
        console.log("readFile orig: " + path);
        if (path.indexOf("node_modules") == -1) {
            var parsed = pathhelper.parse(path);
            path = (this.mode == 'server') ? parsed.dir + '/' + parsed.name + '.server.ts' : path;
        }
        console.log("readFile: " + path);
        return this.app.loadFile(path).buffer.toString();
    }
    fileExists(path) {
        console.log("fileExists orig: " + path);
        if (path.indexOf("node_modules") == -1) {
            var parsed = pathhelper.parse(path);
            path = (this.mode == 'server') ? parsed.dir + '/' + parsed.name + '.server.ts' : path;
        }
        var result = this.app.isFileExists(path);
        console.log("fileExists: " + path + ": " + result);
        return result;
    }
}
exports.default = LanguageServiceHost;
