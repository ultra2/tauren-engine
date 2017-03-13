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
import Engine from './Engine'

export default class Application {

    private engine: Engine
    private name: string
    private loaded: boolean
    public controllers: any

    constructor(application: string, engine: Engine) {
        this.name = application
        this.engine = engine
    }
 
    public async load() : Promise<void>{
        this.loaded = false
        this.controllers = {} //namespace
        try{
            var fileInfo = await this.loadFile("controller.js")
            var F = Function('app', fileInfo.buffer)
            F(this)
            this.loaded = true
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

    public async loadDocument(path:string) {
        var result = await this.engine.db.collection(this.name).findOne({ _id: path })
        result = JSON.stringify(result).replace(/\*/g, '.');
        return JSON.parse(result);
    }

    public async saveDocument(path:string, body:any) {
        body = JSON.stringify(body).replace(/\./g, '*');
        body = JSON.parse(body);
        return await this.engine.db.collection(this.name).update({ _id: path }, body, {upsert: true, w: 1})
    }

    public async uploadFileOrFolder(path:string, data:any) : Promise<model.stubInfo> {
        if (path == "controller.js"){
            var F = Function('app', data)
        }

        var fs = new model.FileSystem(await this.engine.db.collection(this.name).findOne({ _id: "fs" }))
        var s = fs.findOrCreateFileStub(path)
        if (s.stubNew){
            await this.engine.db.collection(this.name).updateOne({ _id: "fs" }, fs, {w: 1, checkKeys: false})
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
        var gfs = gridfs(this.engine.db, mongodb);
        var writestream = gfs.createWriteStream({
            _id : id,
            filename : id,
            root: this.name,
            content_type: mime.lookup(path)
        });
        return await Utils.toStream(data, writestream)
    }

    public async loadFile(path:string) : Promise<fileInfo> {
        var fs = new model.FileSystem(await this.engine.db.collection(this.name).findOne({ _id: "fs" }))
        var data = fs.findOrCreateFileStub(path)
        if (data == null){
            throw Error("not found")
        }

        var filedoc = await this.engine.db.collection(this.name + ".files").findOne({'_id': data.fileId})

        var gfs = gridfs(this.engine.db, mongodb);
        var readstream = gfs.createReadStream({
            _id : filedoc._id,
            root: this.name
        });

        try{
            var buffer = await Utils.fromStream(readstream)
            return {contentType: filedoc.contentType, buffer: buffer}
        }
        catch(err){
            throw Error(err.message)
        }
    }

    public async deleteFile(id:string) {
        var gfs = gridfs(this.engine.db, mongodb);
        gfs.remove({
            _id : id,
            root: this.name
        },function(err){
            console.log(err)
        });
    }

    public async garbageFiles() {
        var fs = new model.FileSystem(await this.engine.db.collection(this.name).findOne({ _id: "fs" }))
        
        var a =JSON.stringify(fs._attachments)
        var b = a.split("_fileId\":\"")
        var c = b.map(function(value){
            return value.substr(0,36)
        })
        var d = c.slice(1)
        
        await this.engine.db.collection(this.name + ".files").remove({'_id': {$nin: d}})
        await this.engine.db.collection(this.name + ".chunks").remove({'files_id': {$nin: d}})
    }
}

export class fileInfo {
    buffer: any
    contentType: string
}