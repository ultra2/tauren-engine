"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const ts = require("typescript");
class LanguageServiceHost {
    getCompilationSettings() {
        var result = new ts.CompilerOptions();
        result.noEmitOnError = true;
        result.noImplicitAny = true;
        result.target = ts.ScriptTarget.ES5;
        result.module = ts.ModuleKind.CommonJS;
        return result;
    }
    getDefaultLibFileName() {
        return null;
    }
    getScriptFileNames() {
        return ['/virtual/' + this.name + "/main.ts"];
    }
    getScriptVersion(fileName) {
        return "1.0.0";
    }
    getScriptSnapshot(fileName) {
        console.log("getScriptSnapshot", fileName);
        if (!fs.existsSync(fileName)) {
            return undefined;
        }
        return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    }
    getCurrentDirectory() {
        return '/virtual/' + this.name;
    }
}
exports.LanguageServiceHost = LanguageServiceHost;
