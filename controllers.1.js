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
const uuid = require("node-uuid");
const mime = require("mime");
const gridfs = require("gridfs-stream");
const JSZip = require('jszip');
const utils_1 = require('./utils');
const model = require('./model');
class stubInfo {
}
class response {
}
exports.response = response;
class dataResponse extends response {
}
exports.dataResponse = dataResponse;
class fileResponse extends response {
}
exports.fileResponse = fileResponse;
class base {
    constructor(db, application) {
        this.db = db;
        this.application = application;
    }
}
exports.base = base;
class database extends base {
    listCollections(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.db.listCollections({}).toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
}
exports.database = database;
class applications extends base {
    list(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = [];
            var data = yield this.db.listCollections({}).toArray();
            data.forEach(function (element, index) {
                var name = element.name.split('.')[0];
                if (name == "system")
                    return;
                if (result.indexOf(name) != -1)
                    return;
                result.push(name);
            });
            return { status: 200, contentType: "text/html", body: result };
        });
    }
    create(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var fileId = uuid.v1();
            yield this.db.collection(url).insertOne({
                _id: "client",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            yield this.db.collection(url).insertOne({
                _id: "server",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            var fileController = new client(this.db, url);
            yield fileController.createFile(fileId, "index.html", "hello");
            return { status: 200, contentType: "applitaion/json", body: { data: "ok" } };
        });
    }
    delete(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.db.collection(url).drop();
            yield this.db.collection(url + ".files").drop();
            yield this.db.collection(url + ".chunks").drop();
            return { status: 200, contentType: "applitaion/json", body: { data: "ok" } };
        });
    }
}
exports.applications = applications;
class application extends base {
    listDocuments(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.db.collection(this.application).find().toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    listFiles(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.db.collection(this.application + ".files").find().toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    listChunks(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.db.collection(this.application + ".chunks").find().toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    loadDocument(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.db.collection(this.application).findOne({ _id: url });
            result = JSON.stringify(result).replace(/\*/g, '.');
            result = JSON.parse(result);
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    saveDocument(url, params, body) {
        return __awaiter(this, void 0, void 0, function* () {
            body = JSON.stringify(body).replace(/\./g, '*');
            body = JSON.parse(body);
            var result = yield this.db.collection(this.application).update({ _id: url }, body, { upsert: true, w: 1 });
            return { status: 200, contentType: "application/json", body: result };
        });
    }
}
exports.application = application;
class client extends base {
    loadFile(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var client = new model.Client(yield this.db.collection(this.application).findOne({ _id: "client" }));
            var data = client.findOrCreateFileStub(url);
            if (data == null) {
                throw Error("not found");
            }
            var filedoc = yield this.db.collection(this.application + ".files").findOne({ '_id': data.fileId });
            var gfs = gridfs(this.db, mongodb);
            var readstream = gfs.createReadStream({
                _id: filedoc._id,
                root: this.application
            });
            try {
                var buffer = yield utils_1.default.fromStream(readstream);
                return { status: 200, contentType: filedoc.contentType, body: buffer };
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
    saveFile(url, params, body) {
        return __awaiter(this, void 0, void 0, function* () {
            body = new Buffer(body, 'base64').toString();
            var data = yield this.uploadFileOrFolder(url, body);
            return { status: 200, contentType: "application/json", body: data };
        });
    }
    uploadFileOrFolder(path, data) {
        return __awaiter(this, void 0, void 0, function* () {
            var client = new model.Client(yield this.db.collection(this.application).findOne({ _id: "client" }));
            var s = client.findOrCreateFileStub(path);
            if (s.stubNew) {
                yield this.db.collection(this.application).updateOne({ _id: "client" }, client, { w: 1, checkKeys: false });
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
    removeFile(id) {
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
    installPackage(url, params, body) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.garbageFiles();
            var githubUrlSplitted = body.githubUrl.split("/");
            var zipUrl = "";
            var owner = githubUrlSplitted[3];
            var reponame = githubUrlSplitted[4].substr(0, githubUrlSplitted[4].length - 4);
            var repository = yield utils_1.default.callService("https://api.github.com/repos/" + owner + "/" + reponame, { json: true });
            if (repository.message) {
                return { status: 200, contentType: "application/json", body: { success: false, message: "Repository not found" } };
            }
            var release = yield utils_1.default.callService("https://api.github.com/repos/" + owner + "/" + reponame + "/releases/latest", { json: true });
            zipUrl = release.zipball_url || ("https://github.com/" + owner + "/" + reponame + "/archive/" + repository.default_branch + ".zip");
            var zipFile = yield utils_1.default.callService(zipUrl, { encoding: null });
            var zipHelper = new JSZip();
            var zip = yield zipHelper.loadAsync(zipFile);
            var client = new model.Client(yield this.db.collection(this.application).findOne({ _id: "client" }));
            for (var key in zip.files) {
                var entry = zip.files[key];
                var path = "packages/" + body.name + key.substr(key.indexOf("/"));
                if (entry.dir)
                    path = path.replace(".", "_");
                var s = client.findOrCreateFileStub(path);
                var tasks = [];
                if (s.stubType == "file") {
                    try {
                        var nodebuffer = yield entry.async("nodebuffer");
                        yield this.createFile(s.fileId, path, nodebuffer);
                        console.log("created: " + path);
                    }
                    catch (err) {
                        console.log(err);
                    }
                }
            }
            console.log("save client doc");
            yield this.db.collection(this.application).updateOne({ _id: "client" }, client, { w: 1, checkKeys: false });
            return { status: 200, contentType: "application/json", body: { success: true, message: "Ok" } };
        });
    }
    garbageFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            var client = new model.Client(yield this.db.collection(this.application).findOne({ _id: "client" }));
            var a = JSON.stringify(client._attachments);
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
exports.client = client;
