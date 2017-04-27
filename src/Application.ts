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

export default class Application {

    private engine: Engine
    private name: string
    private loaded: boolean
    public controllers: any   
    public fs = {}

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

    public async create(){
        await this.engine.db.collection(name).insertOne({
            _id: "fs",
            _attachments: {                        
            }
        }, {w: 1})

        await this.engine.mongo.uploadFileOrFolder("index.html", "hello")
    } 

    public async init(){
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
        var result = await this.engine.db.collection(this.name).findOne({ _id: path })
        result = JSON.stringify(result).replace(/\*/g, '.');
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

    public async build() : Promise<Object> {
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
        this.engine.cache.mkdirpSync("/webpack/" + this.name);

        var tsconfig = await this.engine.mongo.loadFile(this.name + "/" + "tsconfig.json")
        this.engine.cache.writeFileSync("/webpack/tsconfig.json", tsconfig.buffer);

        var scriptts = await this.engine.mongo.loadFile(this.name + "/" + "script.ts")
	    this.engine.cache.writeFileSync("/webpack/script.ts", scriptts.buffer);

        var maints = await this.engine.mongo.loadFile(this.name + "/" + "main.ts")
	    this.engine.cache.writeFileSync("/webpack/main.ts", maints.buffer);
        
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
