"use strict";
const uuid = require("node-uuid");
class Model {
    constructor(jsonObj) {
        if (jsonObj) {
            for (var propName in jsonObj) {
                this[propName] = jsonObj[propName];
            }
        }
    }
}
exports.Model = Model;
class FileSystem extends Model {
    findOrCreateFileStub(path) {
        var result = new stubInfo();
        path = path.replace(/\./g, '*');
        result.stubType = (path.indexOf('*') != -1) ? "file" : "folder";
        var splitted = path.split('/');
        var fileName = "";
        var dirs = [];
        if (result.stubType == "file") {
            fileName = splitted[splitted.length - 1];
            dirs = splitted.slice(0, splitted.length - 1);
        }
        else {
            fileName = "";
            dirs = splitted.slice(0, splitted.length);
        }
        result.stub = this._attachments;
        for (var i = 0; i < dirs.length; i++) {
            var dir = dirs[i];
            if (!result.stub[dir]) {
                result.stub[dir] = {};
                result.stubNew = true;
            }
            result.stub = result.stub[dir];
        }
        if (result.stubType == "file") {
            if (!result.stub[fileName]) {
                result.stub[fileName] = {
                    _fileId: uuid.v1()
                };
                result.stubNew = true;
            }
            result.stub = result.stub[fileName];
            result.fileId = result.stub._fileId;
        }
        return result;
    }
}
exports.FileSystem = FileSystem;
class stubInfo {
}
exports.stubInfo = stubInfo;
