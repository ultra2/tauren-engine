"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
class CompilerHost {
    constructor(_app) {
        this.app = _app;
    }
    getSourceFile(fileName, languageVersion, onError) {
        console.log("getSourceFile", arguments);
        const sourceText = fs.readFileSync(fileName).toString();
        return sourceText !== undefined ? ts.createSourceFile(fileName, sourceText, languageVersion) : undefined;
    }
    getDefaultLibFileName(options) {
        console.log("getDefaultLibFileName", arguments);
        return process.cwd() + "/node_modules/typescript/lib/lib.d.ts";
    }
    writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles) {
        console.log("writeFile", arguments);
        this.app.engine.mongo.writeFile(this.app.name + "/" + fileName, data, function (err, content) {
            if (err) {
                console.log(err);
                return;
            }
        });
    }
    getCurrentDirectory() {
        console.log("getCurrentDirectory", arguments);
        return '/virtual/' + this.app.name;
    }
    getDirectories(path) {
        console.log("getDirectories", arguments);
        return [];
    }
    getCanonicalFileName(fileName) {
        console.log("getCanonicalFileName", arguments);
        return fileName;
    }
    useCaseSensitiveFileNames() {
        console.log("useCaseSensitiveFileNames", arguments);
        return true;
    }
    getNewLine() {
        console.log("getNewLine", arguments);
        return '\n';
    }
    fileExists(fileName) {
        console.log("fileExists", arguments);
        return fs.existsSync(fileName);
    }
    readFile(fileName) {
        console.log("readFile", arguments);
        return fs.readFileSync(fileName).toString();
    }
}
exports.default = CompilerHost;
