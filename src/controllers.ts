/// <reference path="_all.d.ts" />
"use strict";

import * as mongodb from "mongodb"
import * as uuid from "node-uuid"
import * as mime from "mime"
import * as stream from "stream"
import * as gridfs from "gridfs-stream"
import * as JSZip from 'jszip'
import Utils from './utils'
import * as model from './model'
import filemanager from './filemanager'
import DBContext from './DBContext'

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
    public application: string;

    constructor(application: string) {
        this.application = application
    }
}

export class database extends base {
    public async listCollections(url:string, params:Object) : Promise<dataResponse> {
        var result = await DBContext.db.listCollections({}).toArray()
        return { status: 200, contentType: "application/json", body: result }
    }
}

export class applications extends base {

    public async list(url:string, params:Object) : Promise<dataResponse> {
        var result = []
        var data = await DBContext.db.listCollections({}).toArray()
         
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
        
       await DBContext.db.collection(url).insertOne({
            _id: "client",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        await DBContext.db.collection(url).insertOne({
            _id: "server",
            _attachments: {                        
            }
        }, {w: 1, checkKeys: false})

        await filemanager.createFile(this.application, fileId, "index.html", "hello")

        return {status:200, contentType:"applitaion/json", body:{ data:"ok" }}
    }

    public async delete(url:string, params:Object) : Promise<dataResponse> {
        await DBContext.db.collection(url).drop()
        await DBContext.db.collection(url + ".files").drop()
        await DBContext.db.collection(url + ".chunks").drop()
        return {status:200, contentType:"applitaion/json", body:{ data:"ok" }}
    }
}

export class application extends base {

    public async listDocuments(url:string, params:Object) : Promise<dataResponse> {
        var result = await DBContext.db.collection(this.application).find().toArray()
        return { status: 200, contentType: "application/json", body: result }
    }

    public async listFiles(url:string, params:Object) : Promise<dataResponse> {
        var result = await DBContext.db.collection(this.application + ".files").find().toArray()
        return { status: 200, contentType: "application/json", body: result }
    }

    public async listChunks(url:string, params:Object) : Promise<dataResponse> {
        var result = await DBContext.db.collection(this.application + ".chunks").find().toArray()
        return { status: 200, contentType: "application/json", body: result }
    }

    public async loadDocument(url:string, params:Object) : Promise<dataResponse> {
        var result = await DBContext.db.collection(this.application).findOne({ _id: url })
        result = JSON.stringify(result).replace(/\*/g, '.');
        result = JSON.parse(result);
        return { status: 200, contentType: "application/json", body: result }
    }

    public async saveDocument(url:string, params:Object, body:any) : Promise<dataResponse> {
        body = JSON.stringify(body).replace(/\./g, '*');
        body = JSON.parse(body);
        var result = await DBContext.db.collection(this.application).update({ _id: url }, body, {upsert: true, w: 1})
        return { status: 200, contentType: "application/json", body: result }
    }
}

export class client extends base {
     
    public async loadFile(url:string, params:Object) : Promise<fileResponse> {
        try{
            var fileInfo = await filemanager.loadFile(this.application, url)
            return {status: 200, contentType: fileInfo.contentType, body: fileInfo.buffer}
        }
        catch(err){
            throw Error(err.message)
        }
    }

    public async saveFile(url:string, params:Object, body:any) : Promise<response> {
        //body = new Buffer(body.image, 'base64').toString() //curl
        body = new Buffer(body, 'base64').toString()
        var data = await filemanager.uploadFileOrFolder(this.application, url, body)
        return { status: 200, contentType: "application/json", body: data }
    }

    public async removeFile(id:string) {
        //var bucket = new mongodb.GridFSBucket(this.db, { bucketName: this.application });
        var gfs = gridfs(DBContext.db, mongodb);
        gfs.remove({
            _id : id,
            root: this.application
        },function(err){
            console.log(err)
        });
        //await bucket.delete(id)
    }

    public async installPackage(url:string, params:Object, body:any) : Promise<dataResponse> {
        await filemanager.garbageFiles(this.application)
        
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
        var client = new model.Client(await DBContext.db.collection(this.application).findOne({ _id: "client" }))
        
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
                    await filemanager.createFile(this.application, s.fileId, path, nodebuffer)
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
        await DBContext.db.collection(this.application).updateOne({ _id: "client" }, client, {w: 1, checkKeys: false})
        
        return { status: 200, contentType: "application/json", body: { success: true, message: "Ok"} }
    }
}