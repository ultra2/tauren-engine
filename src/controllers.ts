/// <reference path="_all.d.ts" />
"use strict";

import * as mongodb from "mongodb";
import * as uuid from "node-uuid";
import * as mime from "mime";
import * as stream from "stream";
import * as gridfs from "gridfs-stream";
import * as JSZip from 'jszip'
import Utils from './utils'

export class Model {

    constructor(jsonObj?: any) {
        if (jsonObj) {
            for (var propName in jsonObj) {
                this[propName] = jsonObj[propName]
            }
        }
    }
}

export class Client extends Model {
    _id: "client"
    _attachments: {
        packages: {}
    }

    //Find a fileStub in document based on the given filePath
    //stub, stubType, stubCreated
    public findOrCreateFileStub(path:string): stubInfo {
        var result = new stubInfo()      
        result.stubType = (path.indexOf('.') != -1) ? "file" : "folder"

        var splitted = path.split('/')
        var fileName = ""
        var dirs = []

        //file stub?
        if (result.stubType == "file"){
            fileName = splitted[splitted.length-1]
            dirs = splitted.slice(0, splitted.length-1)
        }
        else{
            fileName = ""
            dirs = splitted.slice(0, splitted.length-1)
        }

        result.stub = this._attachments
        for (var i=0; i < dirs.length; i++){
            var dir = dirs[i]
            if (!result.stub[dir]) {
                result.stub[dir] = {}
                result.stubNew = true
            }
            result.stub = result.stub[dir]
        }

        if (result.stubType == "file"){
            if (!result.stub[fileName]) {
                result.stub[fileName] = {
                    _fileId: uuid.v1()
                }
                result.stubNew = true
            }
            result.stub = result.stub[fileName]
            result.fileId = result.stub._fileId
        }

        return result
    }
}

class stubInfo {
    stub: any
    stubType: string
    stubNew: boolean
    fileId: string
}

export class response {
    status: number;
    contentType: string;
    body: any;
}

export class dataResponse extends response {

}

export class fileResponse extends response {

}

export class base {
    public db: mongodb.Db;
    public application: string;

    constructor(db: mongodb.Db, application: string) {
        this.db = db
        this.application = application
    }
}

export class database extends base {
    public async listCollections(url:string, params:Object) : Promise<dataResponse> {
        var result = await this.db.listCollections({}).toArray()
        return { status: 200, contentType: "application/json", body: result }
    }
}

export class applications extends base {

    public async list(url:string, params:Object) : Promise<dataResponse> {
        var result = []
        var data = await this.db.listCollections({}).toArray()
         
        data.forEach(function(element, index){
            var name = element.name.split('.')[0]
            if (name == "system") return
            if (result.indexOf(name) != -1) return
            result.push(name)
        })

        return { status: 200, contentType: "text/html", body: result }
    }

    public async create(url:string, params:Object) : Promise<dataResponse> {
        var fileId = uuid.v1()
        
       await this.db.collection(url).insertOne({
            _id: "client",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        await this.db.collection(url).insertOne({
            _id: "server",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        var fileController = new client(this.db, url)
        await fileController.createFile(fileId, "index.html", "hello")

        return {status:200, contentType:"applitaion/json", body:{ data:"ok" }}
    }

    public async delete(url:string, params:Object) : Promise<dataResponse> {
        await this.db.collection(url).drop()
        await this.db.collection(url + ".files").drop()
        await this.db.collection(url + ".chunks").drop()
        return {status:200, contentType:"applitaion/json", body:{ data:"ok" }}
    }
}

export class application extends base {

    public async listDocuments(url:string, params:Object) : Promise<dataResponse> {
        var result = await this.db.collection(this.application).find().toArray()
        return { status: 200, contentType: "application/json", body: result }
    }

    public async listFiles(url:string, params:Object) : Promise<dataResponse> {
        var result = await this.db.collection(this.application + ".files").find().toArray()
        return { status: 200, contentType: "application/json", body: result }
    }

    public async listChunks(url:string, params:Object) : Promise<dataResponse> {
        var result = await this.db.collection(this.application + ".chunks").find().toArray()
        return { status: 200, contentType: "application/json", body: result }
    }

    public async loadDocument(url:string, params:Object) : Promise<dataResponse> {
        var result = await this.db.collection(this.application).findOne({ _id: url })
        return { status: 200, contentType: "application/json", body: result }
    }

    public async saveDocument(url:string, params:Object, body:any) : Promise<dataResponse> {
        var result = await this.db.collection(this.application).update({ _id: url }, body, {upsert: true, w: 1})
        return { status: 200, contentType: "application/json", body: result }
    }
}

export class client extends base {
     
    public async loadFile(url:string, params:Object) : Promise<fileResponse> {
        var client = new Client(await this.db.collection(this.application).findOne({ _id: "client" }))
        var data = client.findOrCreateFileStub(url)
        if (data == null){
            throw Error("not found")
        }

        var filedoc = await this.db.collection(this.application + ".files").findOne({'_id': data.fileId})

        var gfs = gridfs(this.db, mongodb);
        var readstream = gfs.createReadStream({
            _id : filedoc._id,
            root: this.application
        });

        try{
            var buffer = await Utils.fromStream(readstream)
            return {status: 200, contentType: filedoc.contentType, body: buffer}
        }
        catch(err){
            throw Error(err.message)
        }
    }

    public async saveFile(url:string, params:Object, body:any) : Promise<response> {
        //body = new Buffer(body.image, 'base64').toString() //curl
        body = new Buffer(body, 'base64').toString()
        var data = await this.uploadFileOrFolder(url, body)
        return { status: 200, contentType: "application/json", body: data }
    }

    private async uploadFileOrFolder(path:string, data:any) : Promise<stubInfo> {
        var client = new Client(await this.db.collection(this.application).findOne({ _id: "client" }))
        var s = client.findOrCreateFileStub(path)
        if (s.stubNew){
            await this.db.collection(this.application).updateOne({ _id: "client" }, client, {w: 1, checkKeys: false})
        }

        if (s.stubType == "folder") return s

        if (s.stubType == "file"){
            //if (!s.stubNew){
            //    try{
            //        await this.removeFile(s.fileId) //delete old version
            //    }catch(e){}
            //}
            await this.createFile(s.fileId, path, data)
            return s
        }
    }

    public async createFile(id:string, path:string, data:any) : Promise<Object> {
        var gfs = gridfs(this.db, mongodb);
        var writestream = gfs.createWriteStream({
            _id : id,
            filename : id,
            root: this.application,
            content_type: mime.lookup(path)
        });
        return await Utils.toStream(data, writestream)
    }

    public async removeFile(id:string) {
        //var bucket = new mongodb.GridFSBucket(this.db, { bucketName: this.application });
        var gfs = gridfs(this.db, mongodb);
        gfs.remove({
            _id : id,
            root: this.application
        },function(err){
            console.log(err)
        });
        //await bucket.delete(id)
    }

    public async installPackage(url:string, params:Object, body:any) : Promise<dataResponse> {
        await this.garbageFiles()
        
        var githubUrlSplitted = body.githubUrl.split("/")
        var zipUrl = ""

        var owner = githubUrlSplitted[3]
        var reponame = githubUrlSplitted[4].substr(0,githubUrlSplitted[4].length-4) //remove .git

        var repository = await Utils.callService("https://api.github.com/repos/" + owner + "/" + reponame, { json: true })
        if (repository.message){
          return { status: 200, contentType: "application/json", body: { success: false, message: "Repository not found"} }
        }

        var release = await Utils.callService("https://api.github.com/repos/" + owner + "/" + reponame + "/releases/latest", { json: true })
        zipUrl = release.zipball_url || ("https://github.com/" + owner + "/" + reponame + "/archive/" + repository.default_branch + ".zip")

        var zipFile = await Utils.callService(zipUrl, { encoding: null })
        var zipHelper = new JSZip()
        var zip = await zipHelper.loadAsync(zipFile)

        //add package files
        var client = new Client(await this.db.collection(this.application).findOne({ _id: "client" }))
        
        for (var key in zip.files){
            var entry = zip.files[key]
            var path = "packages/" + body.name + key.substr(key.indexOf("/"))
            if (entry.dir) path = path.replace(".","_")
            var s = client.findOrCreateFileStub(path)

            var tasks = []
            if (s.stubType == "file"){
                try{
                    //var content = await entry.async("string")
                    //var binarystring = await entry.async("binarystring")
                    //var uint8array = await entry.async("uint8array") //Invalid non-string/buffer chunk
                    //var arraybuffer = await entry.async("arraybuffer") //Invalid non-string/buffer chunk
                    var nodebuffer = await entry.async("nodebuffer")
                    await this.createFile(s.fileId, path, nodebuffer)
                    console.log("created: " + path)
                }
                catch(err)
                {
                    console.log(err)
                }
                //tasks.push( this.createFile(s.fileId, path, content) )
            }
        }

        //await Promise.all(tasks)
        console.log("save client doc")
        await this.db.collection(this.application).updateOne({ _id: "client" }, client, {w: 1, checkKeys: false})
        
        return { status: 200, contentType: "application/json", body: { success: true, message: "Ok"} }
    }

    private async garbageFiles() {
        var client = new Client(await this.db.collection(this.application).findOne({ _id: "client" }))
        
        var a =JSON.stringify(client._attachments)
        var b = a.split("_fileId\":\"")
        var c = b.map(function(value){
            return value.substr(0,36)
        })
        var d = c.slice(1)
        
        await this.db.collection(this.application + ".files").remove({'_id': {$nin: d}})
        await this.db.collection(this.application + ".chunks").remove({'files_id': {$nin: d}})
    }
}

