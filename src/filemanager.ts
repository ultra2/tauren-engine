/// <reference path="_all.d.ts" />
"use strict";

import * as mongodb from "mongodb"
import * as uuid from "node-uuid"
import * as mime from "mime"
import * as stream from "stream"
import * as gridfs from "gridfs-stream"
import * as JSZip from 'jszip'
import Utils from './utils'
import DBContext from './DBContext'
import * as model from './model'

export default class FileManager {

    public static async uploadFileOrFolder(application: string, path:string, data:any) : Promise<model.stubInfo> {
        var client = new model.Client(await DBContext.db.collection(application).findOne({ _id: "client" }))
        var s = client.findOrCreateFileStub(path)
        if (s.stubNew){
            await DBContext.db.collection(application).updateOne({ _id: "client" }, client, {w: 1, checkKeys: false})
        }

        if (s.stubType == "folder") return s

        if (s.stubType == "file"){
            //if (!s.stubNew){
            //    try{
            //        await this.removeFile(s.fileId) //delete old version
            //    }catch(e){}
            //}
            await this.createFile(application, s.fileId, path, data)
            return s
        }
    }

    public static async createFile(application: string, id:string, path:string, data:any) : Promise<Object> {
        var gfs = gridfs(DBContext.db, mongodb);
        var writestream = gfs.createWriteStream({
            _id : id,
            filename : id,
            root: application,
            content_type: mime.lookup(path)
        });
        return await Utils.toStream(data, writestream)
    }

    public static async loadFile(application: string, path:string) : Promise<fileInfo> {
        var client = new model.Client(await DBContext.db.collection(application).findOne({ _id: "client" }))
        var data = client.findOrCreateFileStub(path)
        if (data == null){
            throw Error("not found")
        }

        var filedoc = await DBContext.db.collection(application + ".files").findOne({'_id': data.fileId})

        var gfs = gridfs(DBContext.db, mongodb);
        var readstream = gfs.createReadStream({
            _id : filedoc._id,
            root: application
        });

        try{
            var buffer = await Utils.fromStream(readstream)
            return {contentType: filedoc.contentType, buffer: buffer}
        }
        catch(err){
            throw Error(err.message)
        }
    }

    public static async garbageFiles(application: string) {
        var client = new model.Client(await DBContext.db.collection(application).findOne({ _id: "client" }))
        
        var a =JSON.stringify(client._attachments)
        var b = a.split("_fileId\":\"")
        var c = b.map(function(value){
            return value.substr(0,36)
        })
        var d = c.slice(1)
        
        await DBContext.db.collection(application + ".files").remove({'_id': {$nin: d}})
        await DBContext.db.collection(application + ".chunks").remove({'files_id': {$nin: d}})
    }
}

export class fileInfo {
    buffer: any
    contentType: string
}