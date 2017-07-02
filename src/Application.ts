/// <reference path="_all.d.ts" />
"use strict";

import * as path from 'path'
import * as uuid from "node-uuid"
import * as fsextra from 'fs-extra'
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
var gitkit = require('nodegit-kit');
var npmi = require('npmi');

export default class Application {

    public engine: Engine
    public name: string
    public path: string
    private loaded: boolean
    public controllers: any
    public fs = {}
    public languageServiceHost: LanguageServiceHost
    public languageService: ts.LanguageService
    public paths : string[] = []
    public pathversions: ts.MapLike<{ version: number }> = {}
    public filesRoot: object
    public filesArray: Array<any>

    constructor(application: string, engine: Engine) {
        this.name = application
        this.path = "/tmp/repos/" + this.name
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
            var fs = await this.loadDocument("fs")
            if (fs){ 
                var fileInfo = await this.engine.mongo.loadFile(this.name + "/controller.js")
                var F = Function('app', fileInfo.buffer)
                F(this)
                this.loaded = true
                console.log("Application loaded: " + this.name);
                return
            }
            //new method
            //await this.createTree()
            //await this.cache2()
            //await this.npminstall()
            var buffer = await this.dbLoadFileByName("controller.js")
            var F = Function('app', buffer)
            F(this)
            this.loaded = true
            console.log("Application loaded: " + this.name);
            return
        }
        catch (err) {
            console.log("Application could not been loaded: " + this.name + ", " + err);
        }
    }

    public async open(socket: any) {
        await this.createTree()
        await this.cache2(socket)
        await this.npminstall()
        await this.compile(socket)
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

    public createTempDir(){
        var projectpath = "/tmp/virtual/" + this.name
        fsextra.ensureDirSync(projectpath)

        //var virtualpath = "/tmp/virtual"
        //if (!fsextra.existsSync(virtualpath)){
        //    console.log("create " + virtualpath);
        //    fsextra.mkdirSync(virtualpath)
        //}
        //else{
        //    console.log("exists " + virtualpath);
        //}

        //var projectpath = "/tmp/virtual/" + this.name
        //if (!fsextra.existsSync(projectpath)){
        //    console.log("create " + projectpath);
        //    fsextra.mkdirSync(projectpath)
        //}
        //else{
        //    console.log("exists " + projectpath);
        //}

        //console.log('empty ' + projectpath)
        //fsextra.emptyDirSync(projectpath)
    }

    public async cache(socket) {
        this.createTempDir()
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
            fsextra.mkdirpSync("/tmp/virtual/" + path)
            for (var key in fileStub) {
                await this.cacheStub(fileStub[key], path + "/" + key)
            }
        }
        else {
            this.paths.push(path)
            this.pathversions["/virtual" + path] = { version: 0 };
        }
    }
    
    public async cacheFile(path: string) {
        var fileinfo = await this.engine.mongo.loadFile(path)
        if (path[0] != '/') path = '/' + path  //memory-fs fix.
        this.engine.cache.writeFileSync(path, fileinfo.buffer)
        fsextra.writeFileSync("/tmp/virtual/" + path, fileinfo.buffer, { flag : 'w' })
        this.pathversions["/virtual" + path].version++;
    }

    public async cache2(socket?) {
        this.createTempDir()
        if (socket) socket.emit("log", "Caching...")
        await Promise.all(this.filesArray.map( async file => { await this.cacheFile2(file) }))
        if (socket) socket.emit("log", "Caching finished. Files/Folders count: " + this.filesArray.length)
    }
    
    public async cacheFile2(file: any) {
        if (file.contentType == "text/directory"){
            fsextra.mkdirpSync(this.path + '/' + file.path)
            return
        }
        var buffer = await this.dbLoadFileById(file._id)
        fsextra.writeFileSync(this.path + '/' + file.path, buffer, { flag : 'w' })
    }

    //public async cacheFileById(id: string) {
    //    debugger

    //    var file = await new Promise<Object>(function (resolve, reject) {

    //        this.engine.gridfs.findOne({ _id: id}, function (err, file) {
    //            resolve(file);
    //        })
    //    })

    //    if (file["contentType"] == "text/directory"){
    //        fsextra.mkdirpSync(this.path + file.path)
    //        return
    //    }
    //    var buffer = await this.loadFileById(id)
    //    fsextra.writeFileSync(this.path + file.path, buffer, { flag : 'w' })
    //}

    findFile(path) : any{
        var files = this.filesArray.filter(file => file.path === path)
        if (files.length == 0){
            return undefined
        }
        return files[0]
    }

    findFileById(_id) : any{
        var files = this.filesArray.filter(file => file._id === _id)
        if (files.length == 0){
            return undefined
        }
        return files[0]
    }


    public async dbLoadFileById(id: string): Promise<any> {
        var readstream = this.engine.gridfs.createReadStream({
            _id: id,
            root: this.name
        })

        try {
            return await Utils.fromStream(readstream)
        }
        catch (err) {
            throw Error(err.message)
        }
    }

    public async dbLoadFileByName(filename: string): Promise<any> {
        var readstream = this.engine.gridfs.createReadStream({
            filename: filename,
            root: this.name
        })

        try {
            return await Utils.fromStream(readstream)
        }
        catch (err) {
            throw Error(err.message)
        }
    }

    public async createTree(){
        this.filesArray = await this.engine.db.collection(this.name + ".files").find().toArray()
        this.filesRoot = this.filesArray.filter(file => file.metadata.parent_id === null)[0]
        this.createTreeChildren(this.filesRoot, '')
    }

    public createTreeChildren(node, path){
        node.path = path
        if (node.contentType == "text/directory"){
            node.children = this.filesArray.filter(file => file.metadata.parent_id === node._id)
            for (var i in node.children) {
                var child = node.children[i] 
                var childPath = (node.path) ? node.path + '/' + child.filename : child.filename
                this.createTreeChildren(child, childPath)
            }
        }
    }

    public async npminstall() {
        var options = {
	        //name: 'react-split-pane',	// your module name
            //version: '3.10.9',		// expected version [default: 'latest']
	        path: this.path,			// installation path [default: '.']
	        forceInstall: false,	        // force install if set to true (even if already installed, it will do a reinstall) [default: false]
            npmLoad: {				    // npm.load(options, callback): this is the "options" given to npm.load()
                loglevel: 'silent'	    // [default: {loglevel: 'silent'}]
            }
        }

        return new Promise<Object>(function (resolve, reject) {
            npmi(options, function (err, result) {
                if (err) {
                    if (err.code === npmi.LOAD_ERR) {
                        console.log('npm load error')
                        reject(err)
                        return
                    }
                    if (err.code === npmi.INSTALL_ERR) {
                        console.log('npm install error: ' + err.message)
                        reject(err)
                        return
                    }
                    reject(err)
                    return console.log(err.message);
                }
                resolve(result)
            }.bind(this));
        }.bind(this))
    }

    public getCompletionsAtPosition(msg) {

        const completions: ts.CompletionInfo = this.languageService.getCompletionsAtPosition(msg.filePath, msg.position)

        //TODO: duplikacios hiba javitasa
        //for (var i=0; i<completions.entries.length; i++){
        //    var c = completions.entries[i]
        //    if (c.name == "Navigator"){
        //        debugger
        //    }
        //}

        let completionList = completions || {}
        completionList["entries"] = completionList["entries"] || []

        // limit to maxSuggestions
        let maxSuggestions = 1000
        if (completionList["entries"].length > maxSuggestions) completionList["entries"] = completionList["entries"].slice(0, maxSuggestions)

        return completionList
    }

    public async compile(socket): Promise<any> {
        
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
 
        let success = !emitResult.emitSkipped

        let exitCode = success ? "success" : "failed"
        socket.emit("log", "Compile finished: " + exitCode)

        return success
    }

    public async build(socket): Promise<void> {
        if (socket) socket.emit("log", "Build started...")

        return new Promise<void>(function (resolve, reject) {

            try {
                var configFile = fsextra.readFileSync("/tmp/virtual/" + this.name + "/config/webpack.json") 
                var configStr = configFile.toString().replace(/\"\.\//gi, '"' + '/tmp/virtual/' + this.name + '/')
                var config = JSON.parse(configStr)
                var compiler = webpack(config)
            }
            catch(err){
                socket.emit("log", err.message)
                resolve()
                return
            }

            compiler.run(async function (err: Error, stats: webpack.Stats) {
                
                if (err) {
                    socket.emit("log", err.message)
                    resolve()
                    return
                }

                socket.emit("log", stats.toString())
                
                if (stats.hasErrors()){
                    socket.emit("log", "Build failed.")
                    resolve()
                    return
                }
                
                var buffer = fsextra.readFileSync(config.output.path + '/' + config.output.filename)
                await this.engine.mongo.uploadFileOrFolder(config.output.path.substr('/tmp/virtual/'.length) + '/' + config.output.filename, buffer) 
                socket.emit("log", "Build success.")
                resolve()
                return

            }.bind(this))
             
        }.bind(this))
    }
 
    public loadFile(path: string): model.fileInfo {
        var result = new model.fileInfo()
        result.buffer = fsextra.readFileSync("/tmp/virtual/" + path) 
        result.contentType = mime.lookup(path)
        return result
    }
 
    public async loadFile2(path: string): Promise<any> {
        path = path.replace("studio42/", "")
        var result = new model.fileInfo()
        result.buffer = fsextra.readFileSync(this.path + '/' + path) 
        result.contentType = mime.lookup(path)
        return result

        //path = path.replace("studio42/dist/", "");
        //return this.dbLoadFileByName(path)
        //return fsextra.readFileSync(this.path + "/" + path) 

        //path = path.replace("studio42/dist/", "")
        //var result = new model.fileInfo()
        //result.buffer = await this.dbLoadFileByName(path) 
        //result.contentType = mime.lookup(path)
        //return result
    }
 
    public loadFile3(path: string): any {
        path = path.replace("studio42/", "")
        var result = new model.fileInfo()
        result.buffer = fsextra.readFileSync(this.path + '/' + path) 
        result.contentType = mime.lookup(path)
        return result
    }

    public getScriptVersion(fileName: string): string{
        var stat = fsextra.lstatSync(this.path + "/" + fileName)
        return stat.mtime.toString()
    }

    public isFileExists(path: string): boolean {
        return fsextra.existsSync(this.path + "/" + path)
    }

    public async dbUpdateFileContentById(_id: string, content: any, socket?: any) {
        //await this.engine.db.collection(this.name + ".files").findOne({ _id: _id })
        var file = this.findFileById(_id) 
        file["root"] = this.name
        file.metadata.version += 1  
        var writestream = this.engine.gridfs.createWriteStream(file)
        await Utils.toStream(content, writestream)
        fsextra.writeFileSync(this.path + '/' + file.path, content, { flag: 'w' });
        //await this.cacheFile2(file)
    }

    public newFolder(msg: any, socket: any): any {
        fsextra.mkdirpSync(this.path + '/' + msg.path)
        return this.createNode(msg.path)
    }

    public newFile(msg: any, socket: any): any {
        fsextra.writeFileSync(this.path + '/' + msg.path, "", { flag: 'w' });
        return this.createNode(msg.path)
    }

    private createNode(relpath): any {
        var node = {}
        node["filename"] = (relpath == '') ? this.name : path.basename(relpath)
        node["collapse"] = true
        node["path"] = relpath

        var stat = fsextra.lstatSync(this.path + '/' + relpath)
        if (stat.isFile()) (
            node["contentType"] = Utils.getMime(relpath)
        )

        if (stat.isDirectory()){
            node["contentType"] = "text/directory"
            node["children"] = []
            var children = fsextra.readdirSync(this.path + '/' + relpath)
            children = children.sort()
            for (var i in children) { 
                var child = children[i]

                if (child[0] == '.') continue
                if (child == 'node_modules') continue

                var childPath = (relpath) ? relpath + '/' + child : child
                var childNode = this.createNode(childPath)
                node["children"].push(childNode)
            }
        }
        
        return node
    }

    //public async dbCreateFolder(msg: any, socket: any): Promise<any> {
    //    var _id = uuid.v1()
    //    var writestream = this.engine.gridfs.createWriteStream({
    //        _id: _id,
    //        filename: msg.filename,
    //        content_type: "text/directory",
    //        metadata: {
    //            parent_id: msg.parent_id,
    //            version: 0
    //        },
    //        root: this.name
    //    })
    //    await Utils.toStream("", writestream)
    //    return _id
    //}
 
    public async dbCreateFile(msg: any, socket: any): Promise<any> {
        var _id = uuid.v1()
        var writestream = this.engine.gridfs.createWriteStream({
            _id: _id,
            filename: msg.filename,
            content_type: Utils.getMime(msg.filename),
            metadata: {
                parent_id: msg.parent_id,
                version: 0
            },
            root: this.name
        })
        await Utils.toStream("", writestream)
        return _id
    }

    public async WriteFile(fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: ts.SourceFile[]): Promise<void>{
        
        //a DB-be felesleges kiirni, mert fs-bol megy a Static/getFile, adatvesztes nincs.
        fsextra.writeFileSync(this.path + "/" + fileName, data, { flag : 'w' })
        
        //var file =  await this.engine.db.collection(this.name + ".files").findOne({ filename: fileName })
        //var file = this.findFile(fileName)
        //if (file){
        //    await this.updateFileContent(file._id, data)
        //    return
        //}
        //onError("Compile output file is not exists: " + fileName)
        //this.engine.mongo.uploadFileOrFolder(this.name + "/" + fileName, data)
        //fsextra.writeFileSync("/tmp/virtual/" + this.name + "/" + fileName, data, { flag : 'w' })
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
