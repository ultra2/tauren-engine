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
const gridfs = require("gridfs-stream");
const JSZip = require('jszip');
const utils_1 = require('./utils');
const model = require('./model');
const filemanager_1 = require('./filemanager');
const DBContext_1 = require('./DBContext');
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
    constructor(application) {
        this.application = application;
    }
}
exports.base = base;
class database extends base {
    listCollections(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield DBContext_1.default.db.listCollections({}).toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
}
exports.database = database;
class applications extends base {
    list(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = [];
            var data = yield DBContext_1.default.db.listCollections({}).toArray();
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
            yield DBContext_1.default.db.collection(url).insertOne({
                _id: "client",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            yield DBContext_1.default.db.collection(url).insertOne({
                _id: "server",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            yield filemanager_1.default.createFile(this.application, fileId, "index.html", "hello");
            return { status: 200, contentType: "applitaion/json", body: { data: "ok" } };
        });
    }
    delete(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            yield DBContext_1.default.db.collection(url).drop();
            yield DBContext_1.default.db.collection(url + ".files").drop();
            yield DBContext_1.default.db.collection(url + ".chunks").drop();
            return { status: 200, contentType: "applitaion/json", body: { data: "ok" } };
        });
    }
}
exports.applications = applications;
class application extends base {
    listDocuments(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield DBContext_1.default.db.collection(this.application).find().toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    listFiles(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield DBContext_1.default.db.collection(this.application + ".files").find().toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    listChunks(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield DBContext_1.default.db.collection(this.application + ".chunks").find().toArray();
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    loadDocument(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield DBContext_1.default.db.collection(this.application).findOne({ _id: url });
            result = JSON.stringify(result).replace(/\*/g, '.');
            result = JSON.parse(result);
            return { status: 200, contentType: "application/json", body: result };
        });
    }
    saveDocument(url, params, body) {
        return __awaiter(this, void 0, void 0, function* () {
            body = JSON.stringify(body).replace(/\./g, '*');
            body = JSON.parse(body);
            var result = yield DBContext_1.default.db.collection(this.application).update({ _id: url }, body, { upsert: true, w: 1 });
            return { status: 200, contentType: "application/json", body: result };
        });
    }
}
exports.application = application;
class client extends base {
    loadFile(url, params) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var fileInfo = yield filemanager_1.default.loadFile(this.application, url);
                return { status: 200, contentType: fileInfo.contentType, body: fileInfo.buffer };
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
    saveFile(url, params, body) {
        return __awaiter(this, void 0, void 0, function* () {
            body = new Buffer(body, 'base64').toString();
            var data = yield filemanager_1.default.uploadFileOrFolder(this.application, url, body);
            return { status: 200, contentType: "application/json", body: data };
        });
    }
    removeFile(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var gfs = gridfs(DBContext_1.default.db, mongodb);
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
            yield filemanager_1.default.garbageFiles(this.application);
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
            var client = new model.Client(yield DBContext_1.default.db.collection(this.application).findOne({ _id: "client" }));
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
                        yield filemanager_1.default.createFile(this.application, s.fileId, path, nodebuffer);
                        console.log("created: " + path);
                    }
                    catch (err) {
                        console.log(err);
                    }
                }
            }
            console.log("save client doc");
            yield DBContext_1.default.db.collection(this.application).updateOne({ _id: "client" }, client, { w: 1, checkKeys: false });
            return { status: 200, contentType: "application/json", body: { success: true, message: "Ok" } };
        });
    }
}
exports.client = client;
