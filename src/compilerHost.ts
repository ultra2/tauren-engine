import * as ts from "typescript";
import * as fs from "fs"
import Application from "./Application"

export default class CompilerHost implements ts.CompilerHost {

  app: Application

  constructor(_app: Application) {
    this.app = _app;
  }

  getSourceFile(fileName: string, languageVersion: ts.ScriptTarget, onError?: (message: string) => void): ts.SourceFile {
    console.log("getSourceFile", arguments)
    const sourceText = fs.readFileSync(fileName).toString()
    return sourceText !== undefined ? ts.createSourceFile(fileName, sourceText, languageVersion) : undefined;
  }

  getDefaultLibFileName(options: ts.CompilerOptions): string {
    console.log("getDefaultLibFileName", arguments)
    return "/Users/ivanzsolt/Documents/openshift/v3/tauren-engine/node_modules/typescript/lib/lib.d.ts"
  }

  writeFile(fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: ts.SourceFile[]): void {
    console.log("writeFile", arguments)
    this.app.engine.mongo.writeFile(this.app.name + "/" + fileName, data, function(err, content){
      if (err) {
        console.log(err)
        return
      }
    })
    //fs.writeFileSync(fileName, data)
  }
         
  getCurrentDirectory(): string {
    console.log("getCurrentDirectory", arguments)
    return '/virtual/' + this.app.name
  }
  
  getDirectories(path: string): string[]{
    console.log("getDirectories", arguments)
    return []
  }

  getCanonicalFileName(fileName: string): string{
    console.log("getCanonicalFileName", arguments)
    return fileName
  }

  useCaseSensitiveFileNames(): boolean {
    console.log("useCaseSensitiveFileNames", arguments)
    return true
  }

  getNewLine(): string{
    console.log("getNewLine", arguments)
    return '\n'
  }

  fileExists(fileName: string): boolean {
    console.log("fileExists", arguments)
    return fs.existsSync(fileName)
  }

  readFile(fileName: string): string {
    console.log("readFile", arguments)
    return fs.readFileSync(fileName).toString()
  }
}

