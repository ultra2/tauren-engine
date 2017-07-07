/// <reference path="_all.d.ts" />

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
    return ["main.tsx"]
  }

  getScriptVersion(fileName: string): string {
    //console.log("getScriptVersion", fileName)
    if (fileName.indexOf("node_modules/typescript") != -1){
      return ""
    }
    return this.app.getScriptVersion(fileName)
  }

  getScriptSnapshot(fileName: string): ts.IScriptSnapshot | undefined {
    //console.log("getScriptSnapshot", fileName)
                
    if (fileName.indexOf("node_modules/typescript") != -1){
      //console.log("fs: loaded: " + fileName)
      //this.app.engine.io.sockets.emit('log', fileName + " load: " + fsextra.readFileSync(fileName).toString().length)
      return ts.ScriptSnapshot.fromString(fsextra.readFileSync(fileName).toString())
    }

    if (!this.app.isFileExists(fileName)) {
      //console.log("fs: not exists: " + fileName) 
      return undefined
    }
 
    //console.log("fs: loaded: " + fileName)
    var source = this.app.loadFile(fileName).buffer.toString()
    var regex = (this.mode == "server") ? /(\/\/#CLIENT)(?! END)/ : /(\/\/#SERVER)(?! END)/
    var reg = new RegExp(regex, 'g')
    var splitted = source.split(reg)
    var pattern = (this.mode == "server") ? "//#CLIENT" : "//#SERVER"
    var result = ""
    for (var i in splitted){
      var s:string = splitted[i]
      if (s == pattern) continue
      var pos = s.indexOf(pattern + " END")
      result += (pos == -1) ? s : s.substr(pos + 13)
    }
    
    //var regex = (this.mode == "server") ? /(\/\/#CLIENT)([.\S\s]*)(\/\/#CLIENT END)/ : /(\/\/#SERVER)([.\S\s]*)(\/\/#SERVER END)/
    //var source2 = source.replace(new RegExp(regex, 'g'), "");
    return ts.ScriptSnapshot.fromString(result)
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
    return ts.getDefaultLibFilePath(options)
    //return "/node_modules/typescript/lib/" + ts.getDefaultLibFileName(options)
  }

  readFile?(path: string, encoding?: string): string{
    //console.log("readFile: " + path) 
    return this.app.loadFile(path).buffer.toString()
  }
  
  fileExists?(path: string): boolean{
    //console.log("fileExists: " + path) 
    return this.app.isFileExists(path)
  }
}
