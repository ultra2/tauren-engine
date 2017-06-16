/// <reference path="_all.d.ts" />

import * as ts from "typescript";
import * as fs from "fs"
import Application from "./Application"

export default class LanguageServiceHost implements ts.LanguageServiceHost {

  app: Application

  constructor(_app: Application) {
    this.app = _app;
  }

  getScriptFileNames(): string[] {
    return ['/virtual/' + this.app.name + "/main.ts"]
  }

  getScriptVersion(fileName: string): string {
    return this.app.pathversions[fileName] && this.app.pathversions[fileName].version.toString()
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    console.log("getScriptSnapshot", fileName)
                
    if (fileName.substring(0,8) == "/virtual") {
      //console.log("from cache")
      fileName = fileName.substring(8)
      if (!this.app.engine.cache.existsSync(fileName)) {
        return undefined;
      }
      return ts.ScriptSnapshot.fromString(this.app.engine.cache.readFileSync(fileName).toString());
    }

    else {
      //console.log("from fs")
      if (!fs.existsSync(fileName)) {
        return undefined;
      }
      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
    }
  }

  getCurrentDirectory(): string{
    return '/virtual/' + this.app
  }

  getCompilationSettings(): ts.CompilerOptions {
    return { 
        outFile: "dist/main-all.js",
        noEmitOnError: true, 
        noImplicitAny: true,
        target: ts.ScriptTarget.ES5, 
        module: ts.ModuleKind.AMD
    }
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string{
    return ts.getDefaultLibFilePath(options)
  }
}
