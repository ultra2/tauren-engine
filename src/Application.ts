/// <reference path="_all.d.ts" />
"use strict";

import * as fs from "fs"
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
import CompilerHost from "./compilerHost"

export default class Application {

    public engine: Engine
    public name: string
    private loaded: boolean
    public controllers: any
    public fs = {}
    public compilerHost: ts.CompilerHost
    public languageServiceHost: ts.LanguageServiceHost
    public languageService: ts.LanguageService

    constructor(application: string, engine: Engine) {
        this.name = application
        this.engine = engine
        //this.fs['loadFile'] = function (url){
        //    return this.engine.mongo.loadFile(this.name + "/" + url)
        //}.bind(this)
        //this.fs['uploadFileOrFolder'] = function (url, body){
        //    return this.engine.mongo.uploadFileOrFolder(this.name + "/" + url, body)
        //}.bind(this)
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
        this.compilerHost = new CompilerHost(this)
        this.languageServiceHost = this.createLanguageServiceHost()
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

    public async cache() {

        var fs = await this.loadDocument("fs")
        await this.cacheStub(fs._attachments, "/" + this.name)

        //this.engine.cache.mkdirpSync("/" + this.name);

        //var tsconfig = await this.engine.mongo.loadFile(this.name + "/" + "tsconfig.json")
        //this.engine.cache.writeFileSync("/webpack/tsconfig.json", tsconfig.buffer);

        //var scriptts = await this.engine.mongo.loadFile(this.name + "/" + "script.ts")
        //this.engine.cache.writeFileSync("/webpack/script.ts", scriptts.buffer);

        //var maints = await this.engine.mongo.loadFile(this.name + "/" + "main.ts")
        //this.engine.cache.writeFileSync("/webpack/main.ts", maints.buffer);
    }

    public async cacheStub(fileStub: any, path: string) {

        if (path.indexOf('.') == -1) {  //folder?
            this.engine.cache.mkdirpSync(path);
            for (var key in fileStub) {
                await this.cacheStub(fileStub[key], path + "/" + key)
            }
        }
        else {
            await this.cacheFile(path);
        }
    }

    public async cacheFile(path: string) {
        var fileinfo = await this.engine.mongo.loadFile(path)
        if (path[0] != '/') path = '/' + path  //memory-fs fix.
        this.engine.cache.writeFileSync(path, fileinfo.buffer)
    }

    // Create the language service host to allow the LS to communicate with the host
    private createLanguageServiceHost(): ts.LanguageServiceHost {

        return {
            getScriptFileNames: function () {
                return ['/virtual/' + this.name + "/main.ts"]
            }.bind(this),
            getScriptVersion: function (fileName) {
                return "1.0.0"
            }.bind(this),
            getScriptSnapshot: function (fileName) {
                console.log("getScriptSnapshot", fileName)

                if (!fs.existsSync(fileName)) {
                    return undefined;
                }
                return ts.ScriptSnapshot.fromString(fs.readFileSync(fileName).toString());
                //if (!this.engine.cache.existsSync(fileName)) {
                //    return undefined;
                //}
                //return ts.ScriptSnapshot.fromString(this.engine.cache.readFileSync(fileName).toString());
            }.bind(this),
            getCurrentDirectory: function () {
                return '/virtual/' + this.name
            }.bind(this),
            getCompilationSettings: function () {
                return {
                    noEmitOnError: true,
                    noImplicitAny: true,
                    target: ts.ScriptTarget.ES5,
                    module: ts.ModuleKind.CommonJS
                }
            }.bind(this),
            getDefaultLibFileName: function (options) {
                return ts.getDefaultLibFilePath(options)
            }.bind(this),
        }
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

    public async compile(): Promise<Object> {
        

        let program = ts.createProgram(
            this.languageServiceHost.getScriptFileNames(), 
            {
                outFile: "dist/main-all.js",
                noEmitOnError: true,
                noImplicitAny: true,
                target: ts.ScriptTarget.ES5,
                module: ts.ModuleKind.AMD
            },
            this.compilerHost
        )
        
        let emitResult = program.emit()
 


        //var sourceFiles = program.getSourceFiles()

        //sourceFiles.forEach(fileName => {

        //    let output = this.languageService.getEmitOutput(fileName.path);
           
        //    if (!output.emitSkipped) {
        //        console.log("Emitting " + fileName.name);
        //    }
        //    else {
        //        console.log("Emitting " + fileName.name + " failed");
        //    }

        //    output.outputFiles.forEach(o => {
        //        console.log("Emitting " + o.name);
        //        fs.writeFileSync(o.name, o.text)
        //    });
        //})

        //let emitResult = program.emit(null, function(fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: ts.SourceFile[]){
        //    debugger
        //    this.engine.cache.writeFileSync(fileName, data)
        //}, null, null)

        return emitResult.diagnostics
    }

    public async build(): Promise<Object> {
        return { message: "build" }
    }

    public async build2(): Promise<Object> {


        //var path = this.languageServiceHost.getScriptFileNames()[0]
        //let output = this.languageService.getEmitOutput(path);
        //var f0 = output.outputFiles[0]
        //f0.name, f0.text  //csak a main.ts *t forditja le.

        //this.engine.cache.writeFileSync(f0.name, f0.text)

        //var sourceFiles = ['/virtual/' + this.name + "/main.ts"] 

        //const program = ts.createProgram(sourceFiles, options, host);
        //let emitResult = program.emit();


        //var memfs = new MemoryFileSystem()

        //memfs.mkdirpSync("/src");
        //memfs.writeFileSync("/script.ts", await this.fs.loadFile("src/script.ts"));

        //var self = this

        //function getMongoSystem(ts) {
        //    var mongoSystem = {
        //        readFile: function(fileName, encoding) {
        //self.fs.
        //        }
        //    }
        //    return mongoSystem;
        //}

        //var mock = require('mock-fs');
        //mock({
        ///  'virtual': {
        //    'main.ts': 'alert("hello from mock!")'
        //  }
        //});

        //var index = fs.readFileSync('/virtual/index2.html')

        //Load source into cache 

        //await this.cache()

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

        //var ifs = compiler["inputFileSystem"]
        //var ifsfunc = {}

        //function divert(name, self){
        //    ifsfunc[name] = ifs[name].bind(ifs)
        //    ifs[name] = function(path, callback) {
        //        console.log(name + " called: " + path)
        //        if (path.indexOf("node_modules") != -1){
        //            console.log("ifsfunc")
        //            ifsfunc[name](path, callback)
        //        }
        //        else{
        //            console.log("mongofs")
        //            path = path.replace(__dirname,"")
        //            self.fs[name](path, callback)
        //        }
        //    }.bind(self)
        //}

        //divert("stat", this)
        //divert("readdir", this)
        //divert("readFile", this)
        ////divert("readJson", this)
        //divert("readlink", this)
        //divert("statSync", this)
        //divert("readdirSync", this)
        //divert("readFileSync", this)
        ////divert("readJsonSync", this)
        //divert("readlinkSync", this)

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
    }

}
