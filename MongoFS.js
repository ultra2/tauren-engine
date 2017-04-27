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
    constructor(db) {
        this.db = db;
        this.fscache = {};
    }
    isDir(app, relpath) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.findOrCreateStub(app, relpath, false);
            console.log("isDir " + relpath + " = " + (result.stub && result.stubType == "folder"));
            return result.stub && result.stubType == "folder";
        });
    }
    isFile(app, relpath) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.findOrCreateStub(app, relpath, false);
            console.log("isFile " + relpath + " = " + (result.stub && result.stubType == "file"));
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
            var ppath = this.parsePath(path);
            var trueFn = function () { return true; };
            var falseFn = function () { return false; };
            var err = null;
            var stat = null;
            if (yield this.isDir(ppath.app, ppath.relpath)) {
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
            if (yield this.isFile(ppath.app, ppath.relpath)) {
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
    findOrCreateStub(app, relpath, create) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = new model.stubInfo();
            relpath = relpath.replace(/\./g, '*');
            relpath = relpath.replace(/^(\/)/, "");
            result.stubType = (relpath.indexOf('*') != -1) ? "file" : "folder";
            var splitted = relpath.split('/');
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
            yield this.loadFS(app);
            result.stub = this.fscache[app]["_attachments"];
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
    parsePath(path) {
        var result = new parsedPath();
        result.app = path.substring(0, path.indexOf('/'));
        result.relpath = path.substring(path.indexOf('/'));
        return result;
    }
    loadFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var ppath = this.parsePath(path);
            var result = yield this.findOrCreateStub(ppath.app, ppath.relpath, false);
            if (!result.stub) {
                throw Error("not found");
            }
            var filedoc = yield this.db.collection(ppath.app + ".files").findOne({ '_id': result.stub._fileId });
            var gfs = gridfs(this.db, mongodb);
            var readstream = gfs.createReadStream({
                _id: filedoc._id,
                root: ppath.app
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
            var ppath = this.parsePath(path);
            if (ppath.relpath == "controller.js") {
                var F = Function('app', data);
            }
            var result = yield this.findOrCreateStub(ppath.app, ppath.relpath, true);
            if (result.stubNew) {
                yield this.saveFS(ppath.app);
            }
            if (result.stubType == "folder")
                return result;
            if (result.stubType == "file") {
                yield this.createFile(result.stub._fileId, ppath.app, ppath.relpath, data);
                return result;
            }
        });
    }
    loadFS(app) {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.fscache[app])
                return;
            this.fscache[app] = yield this.db.collection(app).findOne({ _id: "fs" });
        });
    }
    saveFS(app) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.collection(app).updateOne({ _id: "fs" }, this.fscache[app], { w: 1 });
        });
    }
    createFile(id, app, relpath, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(this.db, mongodb);
            var writestream = gfs.createWriteStream({
                _id: id,
                filename: id,
                root: app,
                content_type: mime.lookup(relpath)
            });
            return yield utils_1.default.toStream(data, writestream);
        });
    }
    deleteFile(id, app) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(this.db, mongodb);
            gfs.remove({
                _id: id,
                root: app
            }, function (err) {
                console.log(err);
            });
        });
    }
    garbageFiles(app) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.loadFS(app);
            var a = JSON.stringify(this.fscache[app]["_attachments"]);
            var b = a.split("_fileId\":\"");
            var c = b.map(function (value) {
                return value.substr(0, 36);
            });
            var d = c.slice(1);
            yield this.db.collection(app + ".files").remove({ '_id': { $nin: d } });
            yield this.db.collection(app + ".chunks").remove({ 'files_id': { $nin: d } });
        });
    }
}
exports.default = MongoFS;
class parsedPath {
}
