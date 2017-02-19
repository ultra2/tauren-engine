"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const mongodb = require("mongodb");
const mime = require("mime");
const gridfs = require("gridfs-stream");
const utils_1 = require('./utils');
const DBContext_1 = require('./DBContext');
const model = require('./model');
class Application {
    constructor(application, engine) {
        this.name = application;
        this.engine = engine;
    }
    load() {
        return __awaiter(this, void 0, void 0, function* () {
            this.loaded = false;
            this.controllers = {};
            try {
                var fileInfo = yield this.loadFile("controller.js");
                var F = Function('app', fileInfo.buffer);
                F(this);
                this.loaded = true;
            }
            catch (err) {
                console.log("Application could not been loaded: " + this.name + ", " + err);
            }
        });
    }
    listDocuments() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield DBContext_1.default.db.collection(this.name).find().toArray();
        });
    }
    listFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield DBContext_1.default.db.collection(this.name + ".files").find().toArray();
        });
    }
    listChunks() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield DBContext_1.default.db.collection(this.name + ".chunks").find().toArray();
        });
    }
    loadDocument(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield DBContext_1.default.db.collection(this.name).findOne({ _id: path });
            result = JSON.stringify(result).replace(/\*/g, '.');
            return JSON.parse(result);
        });
    }
    saveDocument(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            body = JSON.stringify(body).replace(/\./g, '*');
            body = JSON.parse(body);
            return yield DBContext_1.default.db.collection(this.name).update({ _id: path }, body, { upsert: true, w: 1 });
        });
    }
    uploadFileOrFolder(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var client = new model.Client(yield DBContext_1.default.db.collection(this.name).findOne({ _id: "client" }));
            var s = client.findOrCreateFileStub(path);
            if (s.stubNew) {
                yield DBContext_1.default.db.collection(this.name).updateOne({ _id: "client" }, client, { w: 1, checkKeys: false });
            }
            if (s.stubType == "folder")
                return s;
            if (s.stubType == "file") {
                yield this.createFile(s.fileId, path, data);
                return s;
            }
        });
    }
    createFile(id, path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(DBContext_1.default.db, mongodb);
            var writestream = gfs.createWriteStream({
                _id: id,
                filename: id,
                root: this.name,
                content_type: mime.lookup(path)
            });
            return yield utils_1.default.toStream(data, writestream);
        });
    }
    loadFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var client = new model.Client(yield DBContext_1.default.db.collection(this.name).findOne({ _id: "client" }));
            var data = client.findOrCreateFileStub(path);
            if (data == null) {
                throw Error("not found");
            }
            var filedoc = yield DBContext_1.default.db.collection(this.name + ".files").findOne({ '_id': data.fileId });
            var gfs = gridfs(DBContext_1.default.db, mongodb);
            var readstream = gfs.createReadStream({
                _id: filedoc._id,
                root: this.name
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
    deleteFile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(DBContext_1.default.db, mongodb);
            gfs.remove({
                _id: id,
                root: this.name
            }, function (err) {
                console.log(err);
            });
        });
    }
    garbageFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            var client = new model.Client(yield DBContext_1.default.db.collection(this.name).findOne({ _id: "client" }));
            var a = JSON.stringify(client._attachments);
            var b = a.split("_fileId\":\"");
            var c = b.map(function (value) {
                return value.substr(0, 36);
            });
            var d = c.slice(1);
            yield DBContext_1.default.db.collection(this.name + ".files").remove({ '_id': { $nin: d } });
            yield DBContext_1.default.db.collection(this.name + ".chunks").remove({ 'files_id': { $nin: d } });
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Application;
class fileInfo {
}
exports.fileInfo = fileInfo;
