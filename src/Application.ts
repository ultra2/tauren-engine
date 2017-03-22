/// <reference path="_all.d.ts" />
"use strict";

import * as mongodb from "mongodb"
import * as uuid from "node-uuid"
import * as mime from "mime"
import * as stream from "stream"
import * as gridfs from "gridfs-stream"
import * as JSZip from 'jszip'
import * as webpack from 'webpack'
import Utils from './utils'
import * as model from './model'
import Engine from './Engine'
import MongoFS from './MongoFS'


export default class Application {

    private engine: Engine
    private name: string
    private loaded: boolean
    public fs: MongoFS
    public controllers: any   

    constructor(application: string, engine: Engine) {
        this.name = application
        this.engine = engine
        this.fs = new MongoFS(this.name, this.engine.db)
    }

    public async init(){
        this.loaded = false
        this.controllers = {} //namespace
        try {
            var fileInfo = await this.fs.loadFile("controller.js")
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
        await this.fs.garbageFiles()

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
            var path = "packages/" + name + key.substr(key.indexOf("/"))
            if (entry.dir) path = path.replace(".", "_")
            var result = await this.fs.findOrCreateStub(path, true)

            var tasks = []
            if (result.stubType == "file") {
                try {
                    //var content = await entry.async("string")
                    //var binarystring = await entry.async("binarystring")
                    //var uint8array = await entry.async("uint8array") //Invalid non-string/buffer chunk
                    //var arraybuffer = await entry.async("arraybuffer") //Invalid non-string/buffer chunk
                    var nodebuffer = await entry.async("nodebuffer")
                    await this.fs.createFile(result.stub._fileId, path, nodebuffer)
                    console.log("created: " + path)
                }
                catch (err) {
                    console.log(err)
                }
                //tasks.push( this.createFile(s.fileId, path, content) )
            }
        }

        await this.fs.saveFS
        return { message: "Package installed successfully!" }
    }

    public async build() : Promise<Object> {
        var compiler = webpack({
            context: '/src',
            entry: { app: './script.js' },
            output: {
                filename: 'build.js',
                path: '/build'
            }
        });

        compiler.inputFileSystem = this.fs
        compiler.outputFileSystem = this.fs
        compiler.resolvers.normal.fileSystem = this.fs
        compiler.resolvers.context.fileSystem = this.fs

        return new Promise<Object>(function (resolve, reject) {
            compiler.run(async function (err, stats) {
                if (err) {
                    reject({ message: err })
                }
                resolve({ message: "Ok" })
            }.bind(this));
        }.bind(this))
    }
  
}
