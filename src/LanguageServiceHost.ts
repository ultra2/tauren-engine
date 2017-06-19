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
    return ['/virtual/' + this.app.name + "/main.tsx"]
  }

  getScriptVersion(fileName: string): string {
    return this.app.pathversions[fileName] && this.app.pathversions[fileName].version.toString()
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    console.log("getScriptSnapshot", fileName)
                
    if (fileName.substring(0,13) == "/node_modules") {
      fileName = __dirname.substring(0, __dirname.length-5) + fileName //trimrigth '/dist'
      if (!fs.existsSync(fileName)) {
        console.log("fs: not exists: " + fileName)
        return undefined
      }
      console.log("fs: loaded: " + fileName)
      return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString())
    }

    if (fileName.substring(0,8) == "/virtual") {
      fileName = fileName.substring(8)
      if (!this.app.engine.cache.existsSync(fileName)) {
        console.log("cache: not exists: " + fileName)
        return undefined
      }
      console.log("cache: loaded: " + fileName)
      return ts.ScriptSnapshot.fromString(this.app.engine.cache.readFileSync(fileName).toString())
    }

    console.log("not exists")
    return undefined
  }

  getCurrentDirectory(): string{
    return __dirname
  }

  getCompilationSettings(): ts.CompilerOptions {
    return { 
        outFile: "dist/main-all.js",
        noEmitOnError: true, 
        noImplicitAny: false,
        target: ts.ScriptTarget.ES5, 
        module: ts.ModuleKind.AMD,
        jsx: ts.JsxEmit.React
    }
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string{
    //return ts.getDefaultLibFilePath(options)
    return "/node_modules/typescript/lib/" + ts.getDefaultLibFileName(options)
  }
}
