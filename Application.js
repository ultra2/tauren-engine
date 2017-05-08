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
const fs = require("fs");
const JSZip = require("jszip");
const webpack = require("webpack");
const utils_1 = require("./utils");
class Application {
    constructor(application, engine) {
        this.fs = {};
        this.name = application;
        this.engine = engine;
    }
    create() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.engine.db.collection(name).insertOne({
                _id: "fs",
                _attachments: {}
            }, { w: 1 });
            yield this.engine.mongo.uploadFileOrFolder("index.html", "hello");
        });
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            this.loaded = false;
            this.controllers = {};
            try {
                var fileInfo = yield this.engine.mongo.loadFile(this.name + "/controller.js");
                var F = Function('app', fileInfo.buffer);
                F(this);
                this.loaded = true;
                console.log("Application loaded: " + this.name);
            }
            catch (err) {
                console.log("Application could not been loaded: " + this.name + ", " + err);
            }
        });
    }
    listDocuments() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.engine.db.collection(this.name).find().toArray();
        });
    }
    listFiles() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.engine.db.collection(this.name + ".files").find().toArray();
        });
    }
    listChunks() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.engine.db.collection(this.name + ".chunks").find().toArray();
        });
    }
    loadDocument(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var result = yield this.engine.db.collection(this.name).findOne({ _id: path });
            result = JSON.stringify(result).replace(/\*/g, '.');
            return JSON.parse(result);
        });
    }
    saveDocument(path, body) {
        return __awaiter(this, void 0, void 0, function* () {
            body = JSON.stringify(body).replace(/\./g, '*');
            body = JSON.parse(body);
            return yield this.engine.db.collection(this.name).update({ _id: path }, body, { upsert: true, w: 1 });
        });
    }
    installPackage(githubUrl, name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.engine.mongo.garbageFiles(this.name);
            var githubUrlSplitted = githubUrl.split("/");
            var zipUrl = "";
            var owner = githubUrlSplitted[3];
            var reponame = githubUrlSplitted[4].substr(0, githubUrlSplitted[4].length - 4);
            var repository = yield utils_1.default.callService("https://api.github.com/repos/" + owner + "/" + reponame, { json: true });
            if (repository.message) {
                return { message: "Repository not found!" };
            }
            var release = yield utils_1.default.callService("https://api.github.com/repos/" + owner + "/" + reponame + "/releases/latest", { json: true });
            zipUrl = release.zipball_url || ("https://github.com/" + owner + "/" + reponame + "/archive/" + repository.default_branch + ".zip");
            var zipFile = yield utils_1.default.callService(zipUrl, { encoding: null });
            var zipHelper = new JSZip();
            var zip = yield zipHelper.loadAsync(zipFile);
            for (var key in zip.files) {
                var entry = zip.files[key];
                var relpath = "packages/" + name + key.substr(key.indexOf("/"));
                if (entry.dir)
                    relpath = relpath.replace(".", "_");
                var result = yield this.engine.mongo.findOrCreateStub(this.name, relpath, true);
                var tasks = [];
                if (result.stubType == "file") {
                    try {
                        var nodebuffer = yield entry.async("nodebuffer");
                        yield this.engine.mongo.createFile(result.stub._fileId, this.name, relpath, nodebuffer);
                        console.log("created: " + relpath);
                    }
                    catch (err) {
                        console.log(err);
                    }
                }
            }
            yield this.engine.mongo.saveFS(this.name);
            return { message: "Package installed successfully!" };
        });
    }
    cache() {
        return __awaiter(this, void 0, void 0, function* () {
            var fs = yield this.loadDocument("fs");
            yield this.cacheStub(fs._attachments, "/" + this.name);
        });
    }
    cacheStub(fileStub, path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (path.indexOf('.') == -1) {
                this.engine.cache.mkdirpSync(path);
                for (var key in fileStub) {
                    yield this.cacheStub(fileStub[key], path + "/" + key);
                }
            }
            else {
                var fileinfo = yield this.engine.mongo.loadFile(path);
                this.engine.cache.writeFileSync(path, fileinfo.buffer);
            }
        });
    }
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.cache();
            var compiler = webpack({
                entry: '/virtual/' + this.name + '/main.ts',
                resolve: {
                    extensions: ['.ts']
                },
                module: {
                    rules: [
                        {
                            test: /\.tsx?$/,
                            loader: 'ts-loader',
                            options: {
                                transpileOnly: true
                            }
                        }
                    ]
                },
                output: {
                    path: '/mongo/' + this.name + '/dist',
                    filename: 'build.js'
                }
            });
            compiler["inputFileSystem"] = fs;
            compiler["resolvers"].normal.fileSystem = fs;
            compiler["resolvers"].loader.fileSystem = fs;
            compiler["resolvers"].context.fileSystem = fs;
            compiler.outputFileSystem = fs;
            return new Promise(function (resolve, reject) {
                compiler.run(function (err, stats) {
                    return __awaiter(this, void 0, void 0, function* () {
                        var message = "";
                        if (err) {
                            message += (err.stack || err);
                            if (err.details)
                                message += err.details;
                        }
                        const info = stats.toJson();
                        if (stats.hasErrors())
                            message += info.errors;
                        if (stats.hasWarnings())
                            message += info.warnings;
                        if (message == "")
                            message = "ok";
                        resolve({ message: message });
                    });
                }.bind(this));
            }.bind(this));
        });
    }
}
exports.default = Application;
