/// <reference path="_all.d.ts" />

import * as pathhelper from 'path'
import * as ts from "typescript";
import * as fsextra from 'fs-extra'
import Application from "./Application"

export default class LanguageServiceHost implements ts.LanguageServiceHost {

  app: Application
  mode: string

  constructor(_app: Application, _mode: string) {
    this.app = _app;
    this.mode = _mode
  }

  getScriptFileNames(): string[] {
    return ["main/main.tsx"]
  }

  getScriptVersion(path: string): string {
    console.log("getScriptVersion orig: " + path);
    if (path.indexOf("node_modules") == -1){
      var parsed = pathhelper.parse(path)
      path = (this.mode == 'server') ? parsed.dir + '/' + parsed.name + '.server.ts' : path
    }
    console.log("getScriptVersion: " + path) 
    return this.app.getScriptVersion(path)
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    if (!this.fileExists(fileName)) return undefined
    var source = this.readFile(fileName)
    return ts.ScriptSnapshot.fromString(source)
  }

  getCurrentDirectory(): string{
    return "."
  }

  getCompilationSettings(): ts.CompilerOptions {
    var path = '/config/tsconfig-' + this.mode + '.json'
    if (this.app.isFileExists(path)){
      var tsconfig = this.app.loadFile(path).buffer.toString()
      var result = JSON.parse(tsconfig)
      return result
    }
    
    //return { 
    //    outFile: "dist/client/main-all.js",
    //    noEmitOnError: true, 
    //    noImplicitAny: false,
    //    target: ts.ScriptTarget.ES2016, 
    //    module: ts.ModuleKind.AMD,
    //    jsx: ts.JsxEmit.React
    //}
  }
 
  getDefaultLibFileName(options: ts.CompilerOptions): string{
    //return ts.getDefaultLibFilePath(options)
    return "node_modules/typescript/lib/" + ts.getDefaultLibFileName(options)
  }

  readFile?(path: string, encoding?: string): string{
    console.log("readFile orig: " + path);
    if (path.indexOf("node_modules") == -1){
      var parsed = pathhelper.parse(path)
      path = (this.mode == 'server') ? parsed.dir + '/' + parsed.name + '.server.ts' : path
    }
    console.log("readFile: " + path) 
    return this.app.loadFile(path).buffer.toString()
  }
  
  fileExists?(path: string): boolean{
    console.log("fileExists orig: " + path);
    if (path.indexOf("node_modules") == -1){
      var parsed = pathhelper.parse(path)
      path = (this.mode == 'server') ? parsed.dir + '/' + parsed.name + '.server.ts' : path
    }
    var result = this.app.isFileExists(path)
    console.log("fileExists: " + path + ": " + result) 
    return result
  }
}
