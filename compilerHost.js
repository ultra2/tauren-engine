"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
const fs = require("fs");
class CompilerHost {
    constructor(_app) {
        this.app = _app;
    }
    getSourceFile(fileName, languageVersion, onError) {
        const sourceText = fs.readFileSync(fileName).toString();
        return sourceText !== undefined ? ts.createSourceFile(fileName, sourceText, languageVersion) : undefined;
    }
    getDefaultLibFileName(options) {
        return process.cwd() + "/node_modules/typescript/lib/lib.d.ts";
    }
    writeFile(fileName, data, writeByteOrderMark, onError, sourceFiles) {
        this.app.engine.mongo.writeFile(this.app.name + "/" + fileName, data, function (err, content) {
            if (err) {
                console.log(err);
                return;
            }
        });
    }
    getCurrentDirectory() {
        return '/virtual/' + this.app.name;
    }
    getDirectories(path) {
        return [];
    }
    getCanonicalFileName(fileName) {
        return fileName;
    }
    useCaseSensitiveFileNames() {
        return true;
    }
    getNewLine() {
        return '\n';
    }
    fileExists(fileName) {
        return fs.existsSync(fileName);
    }
    readFile(fileName) {
        return fs.readFileSync(fileName).toString();
    }
}
exports.default = CompilerHost;
