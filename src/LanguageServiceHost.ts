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
    var file = this.app.findFile(fileName)
    if (!file) return "0"
    if (!file.metadata) return "0"
    if (!file.metadata.version) return "0"
    return file.metadata.version.toString()
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    console.log("getScriptSnapshot", fileName)
                
    if (fileName.substring(fileName.length-36) == "node_modules/typescript/lib/lib.d.ts"){
      console.log("fs: loaded: " + fileName)
      return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString())
    }

    if (!this.app.isFileExists(fileName)) {
      console.log("fs: not exists: " + fileName)
      return undefined
    }
 
    console.log("fs: loaded: " + fileName)
    return ts.ScriptSnapshot.fromString(this.app.loadFile2(fileName).toString())

    //if (fileName.substring(0,13) == "/node_modules") {
    //  if (!fsextra.existsSync("/tmp/virtual/" + this.app.name + "/" + fileName)) {
    //    console.log("fs: not exists: " + "/tmp/virtual/" + this.app.name + "/" + fileName)
    //    return undefined
    //  }
    //  console.log("fs: loaded: " + "/tmp/virtual/" + this.app.name + "/" + fileName)
    //  return ts.ScriptSnapshot.fromString(fsextra.readFileSync("/tmp/virtual/" + this.app.name + "/" + fileName).toString())
    //}

    //if (fileName.substring(0,8) == "/virtual") {
    //  fileName = fileName.substring(8)
    //  if (!this.app.engine.cache.existsSync(fileName)) {
    //    console.log("cache: not exists: " + fileName)
    //    return undefined
    //  }
    //  console.log("cache: loaded: " + fileName)
    //  return ts.ScriptSnapshot.fromString(this.app.engine.cache.readFileSync(fileName).toString())
    //}

    //console.log("not exists")
    //return undefined
  }

  getCurrentDirectory(): string{
    return ""
  }

  getCompilationSettings(): ts.CompilerOptions {
    //var configpath = '/tmp/virtual/' + this.app.name + '/config/tsconfig.json'
    //if (fsextra.existsSync(configpath)){
   //   var configFile = fsextra.readFileSync(configpath)
    //  var configStr = configFile.toString()
    //  var config = JSON.parse(configStr)
    //  return config
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
