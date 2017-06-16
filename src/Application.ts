/// <reference path="_all.d.ts" />
"use strict";

import * as mongodb from "mongodb"
import * as mime from "mime"
import * as stream from "stream"
import * as gridfs from "gridfs-stream"
import * as JSZip from 'jszip'
import * as webpack from 'webpack'
import Utils from './utils'
import * as model from './model'
import Engine from './Engine'
import * as ts from "typescript"
import LanguageServiceHost from "./LanguageServiceHost"

export default class Application {

    public engine: Engine
    public name: string
    private loaded: boolean
    public controllers: any
    public fs = {}
    public languageServiceHost: LanguageServiceHost
    public languageService: ts.LanguageService
    public paths : string[] = []
    public pathversions: ts.MapLike<{ version: number }> = {}

    constructor(application: string, engine: Engine) {
        this.name = application
        this.engine = engine
    }

    public async create() {
        await this.engine.db.collection(name).insertOne({
            _id: "fs",
            _attachments: {
            }
        }, { w: 1 })

        await this.engine.mongo.uploadFileOrFolder("index.html", "hello")
    }

    public async init() {
        this.languageServiceHost = new LanguageServiceHost(this) //this.createLanguageServiceHost()
        this.languageService = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry())
        this.loaded = false
        this.controllers = {} //namespace
        try {
            var fileInfo = await this.engine.mongo.loadFile(this.name + "/controller.js")
            var F = Function('app', fileInfo.buffer)
            F(this)
            this.loaded = true
            console.log("Application loaded: " + this.name);
        }
        catch (err) {
            console.log("Application could not been loaded: " + this.name + ", " + err);
        }
    }

    public async listDocuments() {
        return await this.engine.db.collection(this.name).find().toArray()
    }

    public async listFiles() {
        return await this.engine.db.collection(this.name + ".files").find().toArray()
    }

    public async listChunks() {
        return await this.engine.db.collection(this.name + ".chunks").find().toArray()
    }

    public async loadDocument(path: string) {
        var doc = await this.engine.db.collection(this.name).findOne({ _id: path })
        var result = JSON.stringify(doc).replace(/\*/g, '.');
        return JSON.parse(result);
    }

    public async saveDocument(path: string, body: any) {
        body = JSON.stringify(body).replace(/\./g, '*');
        body = JSON.parse(body);
        return await this.engine.db.collection(this.name).update({ _id: path }, body, { upsert: true, w: 1 })
    }

    public async installPackage(githubUrl: string, name: string): Promise<Object> {
        await this.engine.mongo.garbageFiles(this.name)

        var githubUrlSplitted = githubUrl.split("/")
        var zipUrl = ""

        var owner = githubUrlSplitted[3]
        var reponame = githubUrlSplitted[4].substr(0, githubUrlSplitted[4].length - 4) //remove .git

        var repository = await Utils.callService("https://api.github.com/repos/" + owner + "/" + reponame, { json: true })
        if (repository.message) {
            return { message: "Repository not found!" }
        }

        var release = await Utils.callService("https://api.github.com/repos/" + owner + "/" + reponame + "/releases/latest", { json: true })
        zipUrl = release.zipball_url || ("https://github.com/" + owner + "/" + reponame + "/archive/" + repository.default_branch + ".zip")

        var zipFile = await Utils.callService(zipUrl, { encoding: null })
        var zipHelper = new JSZip()
        var zip = await zipHelper.loadAsync(zipFile)

        //add package files

        for (var key in zip.files) {
            var entry = zip.files[key]
            var relpath = "packages/" + name + key.substr(key.indexOf("/"))
            if (entry.dir) relpath = relpath.replace(".", "_")
            var result = await this.engine.mongo.findOrCreateStub(this.name, relpath, true)

            var tasks = []
            if (result.stubType == "file") {
                try {
                    //var content = await entry.async("string")
                    //var binarystring = await entry.async("binarystring")
                    //var uint8array = await entry.async("uint8array") //Invalid non-string/buffer chunk
                    //var arraybuffer = await entry.async("arraybuffer") //Invalid non-string/buffer chunk
                    var nodebuffer = await entry.async("nodebuffer")
                    await this.engine.mongo.createFile(result.stub._fileId, this.name, relpath, nodebuffer)
                    console.log("created: " + relpath)
                }
                catch (err) {
                    console.log(err)
                }
                //tasks.push( this.createFile(s.fileId, path, content) )
            }
        }

        await this.engine.mongo.saveFS(this.name)
        return { message: "Package installed successfully!" }
    }

    public async cache(socket) {
        socket.emit("log", "Caching...")
        var fs = await this.loadDocument("fs")
        this.paths = []
        await this.cacheStub(fs._attachments, "/" + this.name)
        await Promise.all(this.paths.map( async path => { await this.cacheFile(path) }))
        socket.emit("log", "Caching finished. Files count: " + this.paths.length)
    }

    public async cacheStub(fileStub: any, path: string) {

        if (path.indexOf('.') == -1) {  //folder?
            this.engine.cache.mkdirpSync(path);
            for (var key in fileStub) {
                await this.cacheStub(fileStub[key], path + "/" + key)
            }
        }
        else {
            if (!this.isCachable(path)) return
            this.paths.push(path)
            this.pathversions["/virtual" + path] = { version: 0 };
        }
    }
 
    public getExt(path) {
        var re = /(?:\.([^.]+))?$/
        return re.exec(path)[1]
    }

    public isCachable(path) {
        var ext = this.getExt(path)
        return (['ts','tsx','json'].indexOf(ext) != -1)
    }

    public async cacheFile(path: string) {
        if (!this.isCachable(path)) return
        var fileinfo = await this.engine.mongo.loadFile(path)
        if (path[0] != '/') path = '/' + path  //memory-fs fix.
        this.engine.cache.writeFileSync(path, fileinfo.buffer)
        this.pathversions["/virtual" + path].version++;
    }

    public getCompletionsAtPosition(msg) {

        const completions: ts.CompletionInfo = this.languageService.getCompletionsAtPosition('/virtual/' + this.name + msg.filePath, msg.position)

        let completionList = completions || {}
        completionList["entries"] = completionList["entries"] || []

        // limit to maxSuggestions
        let maxSuggestions = 1000
        if (completionList["entries"].length > maxSuggestions) completionList["entries"] = completionList["entries"].slice(0, maxSuggestions)

        return completionList
    }

    public async compile(socket): Promise<void> {
        
        if (socket) socket.emit("log", "Compile started...")

        let program = this.languageService.getProgram()

        let emitResult = program.emit(undefined, this.WriteFile.bind(this))
 
        //let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)

        let allDiagnostics = emitResult.diagnostics

        allDiagnostics.forEach(diagnostic => {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            socket.emit("log", `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        });
 
        let exitCode = emitResult.emitSkipped ? "failed" : "success"

        socket.emit("log", "Compile finished: " + exitCode)
    }

    public WriteFile(fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: ts.SourceFile[]): void{
        this.engine.mongo.uploadFileOrFolder(this.name + "/" + fileName, data)
    }

    public async build(): Promise<Object> {
        return { message: "build" }
    }

   /* public async build2(): Promise<Object> {

        var compiler = webpack({
            //context: '/',
            entry: '/virtual/' + this.name + '/main.ts',
            resolve: {
                extensions: ['.ts'] //ha nincs találat .ts -el is próbálkozik
            },
            module: {
                rules: [
                    {
                        test: /\.tsx?$/,
                        loader: 'ts-loader',
                        options: {
                            transpileOnly: true
                        }
                    }
                ]
            },
            output: {
                path: '/mongo/' + this.name + '/dist',
                filename: 'build.js'
            }
        });

        compiler["inputFileSystem"] = fs //Entry module not found: Error: Can't resolve '/src/script.ts' in '/Users/ivanzsolt/Documents/openshift/v3/tauren-engine'
        compiler["resolvers"].normal.fileSystem = fs //entry module filesystem ./src/script.ts' in '/Users/ivanzsolt/Documents/openshift/v3/tauren-engine'
        compiler["resolvers"].loader.fileSystem = fs //node_modules -t keres a mongofs-ben
        compiler["resolvers"].context.fileSystem = fs

        //compiler.outputFileSystem = this.engine.mongo
        compiler.outputFileSystem = fs

        return new Promise<Object>(function (resolve, reject) {
            compiler.run(async function (err, stats) {
                var message = ""
                if (err) {
                    message += (err.stack || err)
                    if (err.details) message += err.details
                }

                const info = stats.toJson();

                if (stats.hasErrors()) message += info.errors
                if (stats.hasWarnings()) message += info.warnings

                //if (err) {
                //    resolve({ message: err })
                //    return
                //}
                //if (stats.compilation.errors.length > 0){
                //    resolve({ message: stats.compilation.errors[0].message })
                //    return
                //}

                if (message == "") message = "ok"
                resolve({ message: message })
            }.bind(this));
        }.bind(this))
    }*/
}
