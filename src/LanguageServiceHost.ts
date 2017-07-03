/// <reference path="_all.d.ts" />

import * as ts from "typescript";
import * as fsextra from 'fs-extra'
import Application from "./Application"

export default class LanguageServiceHost implements ts.LanguageServiceHost {

  app: Application

  constructor(_app: Application) {
    this.app = _app;
  }

  getScriptFileNames(): string[] {
    return ["main.tsx"]
  }

  getScriptVersion(fileName: string): string {
    //console.log("getScriptVersion", fileName)
    if (fileName.substring(fileName.length-36) == "node_modules/typescript/lib/lib.d.ts"){
      return ""
    }
    return this.app.getScriptVersion(fileName)
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    //console.log("getScriptSnapshot", fileName)
                
    if (fileName.substring(fileName.length-36) == "node_modules/typescript/lib/lib.d.ts"){
      //console.log("fs: loaded: " + fileName)
      return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString())
    }

    if (!this.app.isFileExists(fileName)) {
      //console.log("fs: not exists: " + fileName) 
      return undefined
    }
 
    //console.log("fs: loaded: " + fileName)
    return ts.ScriptSnapshot.fromString(this.app.loadFile(fileName).buffer.toString())
  }

  getCurrentDirectory(): string{
    return ""
  }

  getCompilationSettings(): ts.CompilerOptions {
    //var path = '/config/tsconfig.json'
    //if (this.app.isFileExists(path)){
    //  var tsconfig = this.app.loadFile(path).buffer.toString()
    //  var result = JSON.parse(tsconfig)
    //  return result
    //}
    
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
    return ts.getDefaultLibFilePath(options)
    //return "/node_modules/typescript/lib/" + ts.getDefaultLibFileName(options)
  }
}
