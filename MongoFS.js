"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
var errors = require("errno");
const mongodb = require("mongodb");
const model = require("./model");
const gridfs = require("gridfs-stream");
const mime = require("mime");
const uuid = require("node-uuid");
const utils_1 = require("./utils");
function MemoryFileSystemError(err, path) {
    Error.call(this);
    if (Error.captureStackTrace)
        Error.captureStackTrace(this, arguments.callee);
    this.code = err.code;
    this.errno = err.errno;
    this.message = err.description;
    this.path = path;
}
MemoryFileSystemError.prototype = new Error();
class MongoFS {
    constructor(application, db) {
        this.application = application;
        this.db = db;
    }
    isDir(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.findOrCreateStub(path, false);
            console.log("isDir " + path + " = " + (result.stub && result.stubType == "folder"));
            return result.stub && result.stubType == "folder";
        });
    }
    isFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.findOrCreateStub(path, false);
            console.log("isFile " + path + " = " + (result.stub && result.stubType == "file"));
            return result.stub && result.stubType == "file";
        });
    }
    mkdirp(path, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var fi = yield this.uploadFileOrFolder(path, null);
                callback(null, null);
            }
            catch (err) {
                callback(err, null);
            }
        });
    }
    readFileSync(_path, encoding) {
        console.log("!!!!readFileSync!!!! " + _path);
        return "";
    }
    access(_path, callback) {
        console.log("!!!!access!!!! " + _path);
        return "";
    }
    readJson(path, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("readJson " + path);
            try {
                var fi = yield this.loadFile(path);
                var data = JSON.parse(fi.buffer.toString("utf-8"));
                callback(null, data);
            }
            catch (err) {
                err = {
                    code: errors.code.ENOENT.code,
                    errno: errors.code.ENOENT.errno,
                    message: errors.code.ENOENT.description,
                    path: path
                };
                callback(err, null);
            }
        });
    }
    readFile(path, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("readfile " + path);
            try {
                var fi = yield this.loadFile(path);
                callback(null, fi.buffer);
            }
            catch (err) {
                err = {
                    code: errors.code.ENOENT.code,
                    errno: errors.code.ENOENT.errno,
                    message: errors.code.ENOENT.description,
                    path: path
                };
                callback(err, null);
            }
        });
    }
    writeFile(path, content, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var fi = yield this.uploadFileOrFolder(path, content);
                callback(null, null);
            }
            catch (err) {
                callback(err, null);
            }
        });
    }
    readlink(path, callback) {
        console.log("readlink " + path);
        var err = {
            code: errors.code.ENOSYS.code,
            errno: errors.code.ENOSYS.errno,
            message: errors.code.ENOSYS.description,
            path: path
        };
        callback(err, null);
    }
    stat(path, callback) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log("stat " + path);
            var trueFn = function () { return true; };
            var falseFn = function () { return false; };
            var err = null;
            var stat = null;
            if (yield this.isDir(path)) {
                stat = {
                    isFile: falseFn,
                    isDirectory: trueFn,
                    isBlockDevice: falseFn,
                    isCharacterDevice: falseFn,
                    isSymbolicLink: falseFn,
                    isFIFO: falseFn,
                    isSocket: falseFn
                };
            }
            if (yield this.isFile(path)) {
                stat = {
                    isFile: trueFn,
                    isDirectory: falseFn,
                    isBlockDevice: falseFn,
                    isCharacterDevice: falseFn,
                    isSymbolicLink: falseFn,
                    isFIFO: falseFn,
                    isSocket: falseFn
                };
            }
            if (!stat) {
                err = {
                    code: errors.code.ENOENT.code,
                    errno: errors.code.ENOENT.errno,
                    message: errors.code.ENOENT.description,
                    path: path
                };
            }
            callback(err, stat);
        });
    }
    normalize(path) {
        var parts = path.split(/(\\+|\/+)/);
        if (parts.length === 1)
            return path;
        var result = [];
        var absolutePathStart = 0;
        for (var i = 0, sep = false; i < parts.length; i++, sep = !sep) {
            var part = parts[i];
            if (i === 0 && /^([A-Z]:)?$/i.test(part)) {
                result.push(part);
                absolutePathStart = 2;
            }
            else if (sep) {
                result.push(part[0]);
            }
            else if (part === "..") {
                switch (result.length) {
                    case 0:
                        result.push(part);
                        break;
                    case 2:
                        i++;
                        sep = !sep;
                        result.length = absolutePathStart;
                        break;
                    case 4:
                        if (absolutePathStart === 0) {
                            result.length -= 3;
                        }
                        else {
                            i++;
                            sep = !sep;
                            result.length = 2;
                        }
                        break;
                    default:
                        result.length -= 3;
                        break;
                }
            }
            else if (part === ".") {
                switch (result.length) {
                    case 0:
                        result.push(part);
                        break;
                    case 2:
                        if (absolutePathStart === 0) {
                            result.length--;
                        }
                        else {
                            i++;
                            sep = !sep;
                        }
                        break;
                    default:
                        result.length--;
                        break;
                }
            }
            else if (part) {
                result.push(part);
            }
        }
        if (result.length === 1 && /^[A-Za-z]:$/.test(result[0]))
            return result[0] + "\\";
        return result.join("");
    }
    join(path, request) {
        var absoluteWinRegExp = /^[A-Z]:([\\\/]|$)/i;
        var absoluteNixRegExp = /^\//i;
        if (!request)
            return this.normalize(path);
        if (absoluteWinRegExp.test(request))
            return this.normalize(request.replace(/\//g, "\\"));
        if (absoluteNixRegExp.test(request))
            return this.normalize(request);
        if (path == "/")
            return this.normalize(path + request);
        if (absoluteWinRegExp.test(path))
            return this.normalize(path.replace(/\//g, "\\") + "\\" + request.replace(/\//g, "\\"));
        if (absoluteNixRegExp.test(path))
            return this.normalize(path + "/" + request);
        return this.normalize(path + "/" + request);
    }
    findOrCreateStub(path, create) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = new model.stubInfo();
            path = path.replace(/\./g, '*');
            path = path.replace(/^(\/)/, "");
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
            yield this.loadFS();
            result.stub = this.fsobj["_attachments"];
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                if (!result.stub[dir]) {
                    if (!create) {
                        result.stub = null;
                        return result;
                    }
                    result.stub[dir] = {};
                    result.stubNew = true;
                }
                result.stub = result.stub[dir];
            }
            if (result.stubType == "file") {
                if (!result.stub[fileName]) {
                    if (!create) {
                        result.stub = null;
                        return result;
                    }
                    result.stub[fileName] = { _fileId: uuid.v1() };
                    result.stubNew = true;
                }
                result.stub = result.stub[fileName];
            }
            return result;
        });
    }
    loadFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.findOrCreateStub(path, false);
            if (!result.stub) {
                throw Error("not found");
            }
            var filedoc = yield this.db.collection(this.application + ".files").findOne({ '_id': result.stub._fileId });
            var gfs = gridfs(this.db, mongodb);
            var readstream = gfs.createReadStream({
                _id: filedoc._id,
                root: this.application
            });
            try {
                var buffer = yield utils_1.default.fromStream(readstream);
                return { contentType: filedoc.contentType, buffer: buffer };
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
    uploadFileOrFolder(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (path == "controller.js") {
                var F = Function('app', data);
            }
            var result = yield this.findOrCreateStub(path, true);
            if (result.stubNew) {
                yield this.saveFS();
            }
            if (result.stubType == "folder")
                return result;
            if (result.stubType == "file") {
                yield this.createFile(result.stub._fileId, path, data);
                return result;
            }
        });
    }
    loadFS() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.fsobj)
                return;
            this.fsobj = yield this.db.collection(this.application).findOne({ _id: "fs" });
        });
    }
    saveFS() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.collection(this.application).updateOne({ _id: "fs" }, this.fsobj, { w: 1 });
        });
    }
    createFile(id, path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(this.db, mongodb);
            var writestream = gfs.createWriteStream({
                _id: id,
                filename: id,
                root: this.application,
                content_type: mime.lookup(path)
            });
            return yield utils_1.default.toStream(data, writestream);
        });
    }
    deleteFile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(this.db, mongodb);
            gfs.remove({
                _id: id,
                root: this.application
            }, function (err) {
                console.log(err);
            });
        });
    }
    garbageFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadFS();
            var a = JSON.stringify(this.fsobj["_attachments"]);
            var b = a.split("_fileId\":\"");
            var c = b.map(function (value) {
                return value.substr(0, 36);
            });
            var d = c.slice(1);
            yield this.db.collection(this.application + ".files").remove({ '_id': { $nin: d } });
            yield this.db.collection(this.application + ".chunks").remove({ 'files_id': { $nin: d } });
        });
    }
}
exports.default = MongoFS;
