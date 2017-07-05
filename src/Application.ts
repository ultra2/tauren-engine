/// <reference path="_all.d.ts" />
"use strict";

import * as path from 'path'
import * as uuid from "node-uuid"
import * as fsextra from 'fs-extra'
import * as mongodb from "mongodb"
import * as stream from "stream"
import * as gridfs from "gridfs-stream"
import * as JSZip from 'jszip'
import * as webpack from 'webpack'
import Utils from './utils'
import * as model from './model'
import Engine from './Engine'
import * as ts from "typescript"
import LanguageServiceHost from "./LanguageServiceHost"
var Git = require("nodegit")
var gitkit = require('nodegit-kit')
var npmi = require('npmi')

export default class Application {

    public engine: Engine
    public name: string
    public path: string
    private loaded: boolean
    public controllers: any
    public fs = {}
    public languageServiceHostServer: LanguageServiceHost
    public languageServiceHostClient: LanguageServiceHost
    public languageServiceServer: ts.LanguageService
    public languageServiceClient: ts.LanguageService
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
        this.languageServiceHostServer = new LanguageServiceHost(this, "server")
        this.languageServiceHostClient = new LanguageServiceHost(this, "client")
        this.languageServiceServer = ts.createLanguageService(this.languageServiceHostServer, ts.createDocumentRegistry())
        this.languageServiceClient = ts.createLanguageService(this.languageServiceHostClient, ts.createDocumentRegistry())
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
            var file = await this.dbLoadFile("server/controller.js")
            var F = Function('app', file.buffer)
            F(this)
            this.loaded = true
            console.log("Application loaded: " + this.name);
            return
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

    public async dbLoadFile(path: string): Promise<model.fileInfo> {
        try {
            var result = new model.fileInfo()

            //contentType
            var filedesc = await this.engine.db.collection(this.name + ".files").findOne({ filename: path })
            result.contentType = filedesc.contentType

            //buffer
            var readstream = this.engine.gridfs.createReadStream({
                filename: path,
                root: this.name
            })
            result.buffer = await Utils.fromStream(readstream)

            return result
        }
        catch (err) {
            throw Error(err.message)
        }
    }

    public async dbSaveFile(path: string, content: any, socket: any): Promise<void> {
        try {
            var filedesc = await this.engine.db.collection(this.name + ".files").findOne({ filename: path })
            var _id = (filedesc) ? filedesc._id : uuid.v1()

            var writestream = this.engine.gridfs.createWriteStream({
                _id: _id,
                filename: path,
                content_type: Utils.getMime(path),
                root: this.name
            })

            await Utils.toStream(content, writestream)
        }
        catch (err) {
            throw Error(err.message)
        }    
    }

   //public async createTree(){
   //     this.filesArray = await this.engine.db.collection(this.name + ".files").find().toArray()
   //     this.filesRoot = this.filesArray.filter(file => file.metadata.parent_id === null)[0]
   //     this.createTreeChildren(this.filesRoot, '')
   // }

   // public createTreeChildren(node, path){
   //     node.path = path
   //     if (node.contentType == "text/directory"){
   //         node.children = this.filesArray.filter(file => file.metadata.parent_id === node._id)
   //         for (var i in node.children) {
   //             var child = node.children[i] 
   //             var childPath = (node.path) ? node.path + '/' + child.filename : child.filename
   //             this.createTreeChildren(child, childPath)
   //         }
   //     }
   // }

    private async getRepositorySsh(): Promise<string> {
        var registry = (await this.engine.db.collection(this.name).find().toArray())[0]
        return registry.repository.ssh
    }

    private async getRepositoryUrl(): Promise<string> {
        var registry = (await this.engine.db.collection(this.name).find().toArray())[0]
        return registry.repository.url.replace("https://", "https://oauth2:" + this.engine.gitLabAccessToken + "@")
    }

    public async open(socket: any): Promise<any> {
        var repo = null
        if (!fsextra.existsSync(this.path)){
            repo = await this.clone(socket)
            await this.npminstall(socket)
        }
        else{
            repo = await this.update(socket)
        }
        return repo
    }

    public async clone(socket: any): Promise<any> {
        socket.emit("log", "clone...")
        try {
            var repossh = await this.getRepositoryUrl()
            //var cloneOptions = { fetchOpts: { callbacks: this.engine.getRemoteCallbacks() } }
            var repo = await Git.Clone(repossh, this.path)
            socket.emit("log", "clone success")
            return repo
        }
        catch(err){
            console.log(err)
            socket.emit("log", err.message)
            throw err
        }
    }

    public async update(socket: any): Promise<any> {
        socket.emit("log", "update...")
        var repo = await Git.Repository.open(this.path) 
        //await repo.fetchAll({ callbacks: this.engine.getRemoteCallbacks() })
        await repo.fetchAll()
        //var signature = Signature.default(repo);
        var signature = this.getSignature()
        await repo.mergeBranches("master", "origin/master", signature, null, { fileFavor: Git.Merge.FILE_FAVOR.THEIRS })
        socket.emit("log", "update success")
        return repo
    }

    public async npminstall(socket: any) {
        socket.emit("log", "npm install...")
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
                        socket.emit("log", "npm install: load error")
                        reject(err)
                        return
                    }
                    if (err.code === npmi.INSTALL_ERR) {
                        console.log('npm install error: ' + err.message)
                        socket.emit("log", "npm install: " + err.message)
                        reject(err)
                        return
                    }
                    reject(err)
                    console.log(err.message);
                    socket.emit("log", "npm install: " + err.message)
                }
                resolve(result)
                socket.emit("log", "npm install success")
            }.bind(this));
        }.bind(this))
    }

    public async push(socket: any) {
        try{
            socket.emit("log", "push...")

            var repo = await Git.Repository.open(this.path) 
    
            await gitkit.config.set(repo, {
                'user.name': 'John Doe',
                'user.email': 'johndoe@example.com'
            })

            var diff = await gitkit.diff(repo)
            console.log(diff)

            await gitkit.commit(repo, {
                'message': 'commit message'
            });

            var log = await gitkit.log(repo)
            console.log(log)

            //index
            //var index = await repo.refreshIndex()
            //var index = await repo.index()
            //var a = await index.removeAll()
            //var a2 =await index.addAll()
            //var a3 =await index.write()
            //var oid = await index.writeTree()

            //commit
            //await repo.createCommit("HEAD", signature, signature, "initial commit", oid, [])
             
            //remote
            var remote = await Git.Remote.lookup(repo, "origin")
            if (remote == null){
                var repourl = await this.getRepositoryUrl()
                remote = await Git.Remote.create(repo, "origin", repourl)
            }

            //push
            //await remote.push(["refs/heads/master:refs/heads/master"], { callbacks: this.engine.getRemoteCallbacks() })
            await remote.push(["refs/heads/master:refs/heads/master"])
            socket.emit("log", "push success")
        }
        catch(err){
            console.log(err)
        }
    }

    public getSignature(){
        return Git.Signature.create("Foo bar", "foo@bar.com", 123456789, 60);
    }

    public getCompletionsAtPosition(msg) {
        const languageService = (msg.mode == 'server') ? this.languageServiceServer : this.languageServiceClient

        const completions: ts.CompletionInfo = languageService.getCompletionsAtPosition(msg.filePath, msg.position)

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

    public async compile(socket: any, mode: string): Promise<any> {
        var serverSuccess = await this.compileStep(socket, "server")
        var clientSuccess = await this.compileStep(socket, "client")
        return serverSuccess && clientSuccess 
    }

    public async compileStep(socket: any, mode: string): Promise<any> {
        const languageService = (mode == 'server') ? this.languageServiceServer : this.languageServiceClient

        if (socket) socket.emit("log", "compile " + mode + "...")

        let program = languageService.getProgram()
        let emitResult = program.emit(undefined, this.WriteFile.bind(this))

        //let allDiagnostics = ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics)
        let allDiagnostics = emitResult.diagnostics

        allDiagnostics.forEach(diagnostic => {
            let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
            let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
            socket.emit("log", `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
        });
 
        let success = !emitResult.emitSkipped

        if (!success){
            socket.emit("log", "compile " + mode + " failed")
        }else{
            socket.emit("log", "compile " + mode + " success")
        }

        return success
    }

    public async build(socket): Promise<void> {
        if (socket) socket.emit("log", "build...")

        return new Promise<void>(function (resolve, reject) {

            try {
                var configFile = fsextra.readFileSync(this.path + "/config/webpack.json") 
                var configStr = configFile.toString().replace(/\"\.\//gi, '"' + this.path + '/')
                var config = JSON.parse(configStr)
                var compiler = webpack(config)
            }
            catch(err){
                if (socket) socket.emit("log", err.message)
                resolve()
                return
            }

            compiler.run(async function (err: Error, stats: webpack.Stats) {
                
                if (err) {
                    socket.emit("log", err.message)
                    resolve()
                    return
                }

                if (socket) socket.emit("log", stats.toString())
                
                if (stats.hasErrors()){
                    socket.emit("log", "build failed.")
                    resolve()
                    return
                }
                
                if (socket) socket.emit("log", "build success.")
                resolve()
                return

            }.bind(this))
             
        }.bind(this))
    }

    public async publish(socket): Promise<void> {
        if (socket) socket.emit("log", "publish...")

        var paths: Array<string> = []
        this.publishNode("dist", paths, socket)

        await Promise.all(paths.map(async path => { await this.publishFile(path, socket) }))

    //    var buffer = fsextra.readFileSync(config.output.path + '/' + config.output.filename)
    //    await this.engine.mongo.uploadFileOrFolder(config.output.path.substr('/tmp/virtual/'.length) + '/' + config.output.filename, buffer) 
        
        if (socket) socket.emit("log", "publish success.")
    }

    public publishNode(path: string, paths: Array<string>, socket: any) {
        var stat = fsextra.lstatSync(this.path + '/' + path)

        if (stat.isFile()) {
            paths.push(path)
            return
        }

        if (stat.isDirectory()){
            var children = fsextra.readdirSync(this.path + '/' + path)
            for (var i in children) { 
                var child = children[i]

                if (child[0] == '.') continue

                var childPath = (path) ? path + '/' + child : child
                this.publishNode(childPath, paths, socket)
            }
            return
        }
    }

    public async publishFile(path: string, socket: any): Promise<void> {
        var buffer = fsextra.readFileSync(this.path + '/' + path)
        var pathToSave = path.substr(5) //remove 'dist/', we dont need it in db
        await this.dbSaveFile(pathToSave, buffer, socket)
        //if (socket) socket.emit("log", "Publish file: " + path)
    }
 
    public loadFile(path: string): any {
        var result = new model.fileInfo()
        result.buffer = fsextra.readFileSync(this.path + '/' + path) 
        result.contentType = Utils.getMime(path)
        //this.engine.io.sockets.emit('log', path + " load: " + result.buffer.toString().length)
        return result
    }

    public getScriptVersion(fileName: string): string{
        var stat = fsextra.lstatSync(this.path + "/" + fileName)
        var result = stat.mtime.toString()
        //this.engine.io.sockets.emit('log', path + ": " + result)
        return result
    }

    public isFileExists(path: string): boolean {
        var result = fsextra.existsSync(this.path + "/" + path)
        //this.engine.io.sockets.emit('log', path + ": " + result)
        return result
    }

    //public async dbUpdateFileContentById(_id: string, content: any, socket?: any) {
        //await this.engine.db.collection(this.name + ".files").findOne({ _id: _id })
    //    var file = this.findFileById(_id) 
    //    file["root"] = this.name
    //    file.metadata.version += 1  
    //    var writestream = this.engine.gridfs.createWriteStream(file)
    //    await Utils.toStream(content, writestream)
    //    fsextra.writeFileSync(this.path + '/' + file.path, content, { flag: 'w' });
        //await this.cacheFile2(file)
    //}

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
        node["collapsed"] = (relpath != '')
        node["path"] = relpath

        var stat = fsextra.lstatSync(this.path + '/' + relpath)
        if (stat.isFile()) {
            node["contentType"] = Utils.getMime(relpath)
        }

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
 
    public async WriteFile(fileName: string, data: string, writeByteOrderMark: boolean, onError?: (message: string) => void, sourceFiles?: ts.SourceFile[]): Promise<void>{
        fsextra.writeFileSync(this.path + "/" + fileName, data, { flag : 'w' })
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
