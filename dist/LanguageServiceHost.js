"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fsextra = require("fs-extra");
class LanguageServiceHost {
    constructor(_app, _mode) {
        this.app = _app;
        this.mode = _mode;
    }
    getScriptFileNames() {
        return ["main.tsx"];
    }
    getScriptVersion(fileName) {
        if (fileName.indexOf("node_modules/typescript") != -1) {
            return "";
        }
        return this.app.getScriptVersion(fileName);
    }
    getScriptSnapshot(fileName) {
        if (fileName.indexOf("node_modules/typescript") != -1) {
            return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString());
        }
        if (!this.app.isFileExists(fileName)) {
            return undefined;
        }
        var source = this.app.loadFile(fileName).buffer.toString();
        var regex = (this.mode == "server") ? /(\/\/#CLIENT)(?! END)/ : /(\/\/#SERVER)(?! END)/;
        var reg = new RegExp(regex, 'g');
        var splitted = source.split(reg);
        var pattern = (this.mode == "server") ? "//#CLIENT" : "//#SERVER";
        var result = "";
        for (var i in splitted) {
            var s = splitted[i];
            if (s == pattern)
                continue;
            var pos = s.indexOf(pattern + " END");
            result += (pos == -1) ? s : s.substr(pos + 13);
        }
        return ts.ScriptSnapshot.fromString(result);
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
        return ts.getDefaultLibFilePath(options);
    }
    readFile(path, encoding) {
        return this.app.loadFile(path).buffer.toString();
    }
    fileExists(path) {
        return this.app.isFileExists(path);
    }
}
exports.default = LanguageServiceHost;
