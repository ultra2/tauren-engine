/// <reference path="_all.d.ts" />
"use strict";

import * as uuid from "node-uuid";

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
        path = path.replace(/\./g, '*');
        result.stubType = (path.indexOf('*') != -1) ? "file" : "folder"

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

export class stubInfo {
    stub: any
    stubType: string
    stubNew: boolean
    fileId: string
}


