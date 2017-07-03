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
const path = require("path");
const uuid = require("node-uuid");
const fsextra = require("fs-extra");
const mime = require("mime");
const JSZip = require("jszip");
const webpack = require("webpack");
const utils_1 = require("./utils");
const model = require("./model");
const ts = require("typescript");
const LanguageServiceHost_1 = require("./LanguageServiceHost");
var Git = require("nodegit");
var gitkit = require('nodegit-kit');
var npmi = require('npmi');
class Application {
    constructor(application, engine) {
        this.fs = {};
        this.paths = [];
        this.pathversions = {};
        this.name = application;
        this.path = "/tmp/repos/" + this.name;
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
            this.languageServiceHost = new LanguageServiceHost_1.default(this);
            this.languageService = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry());
            this.loaded = false;
            this.controllers = {};
            try {
                var fs = yield this.loadDocument("fs");
                if (fs) {
                    var fileInfo = yield this.engine.mongo.loadFile(this.name + "/controller.js");
                    var F = Function('app', fileInfo.buffer);
                    F(this);
                    this.loaded = true;
                    console.log("Application loaded: " + this.name);
                    return;
                }
                var file = yield this.dbLoadFile("server/controller.js");
                var F = Function('app', file.buffer);
                F(this);
                this.loaded = true;
                console.log("Application loaded: " + this.name);
                return;
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
            var doc = yield this.engine.db.collection(this.name).findOne({ _id: path });
            var result = JSON.stringify(doc).replace(/\*/g, '.');
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
    dbLoadFileById(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var readstream = this.engine.gridfs.createReadStream({
                _id: id,
                root: this.name
            });
            try {
                return yield utils_1.default.fromStream(readstream);
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
    dbLoadFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var result = new model.fileInfo();
                var filedesc = yield this.engine.db.collection(this.name + ".files").findOne({ filename: path });
                result.contentType = filedesc.contentType;
                var readstream = this.engine.gridfs.createReadStream({
                    filename: path,
                    root: this.name
                });
                result.buffer = yield utils_1.default.fromStream(readstream);
                return result;
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
    dbSaveFile(path, content, socket) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                var filedesc = yield this.engine.db.collection(this.name + ".files").findOne({ filename: path });
                var _id = (filedesc) ? filedesc._id : uuid.v1();
                var writestream = this.engine.gridfs.createWriteStream({
                    _id: _id,
                    filename: path,
                    content_type: utils_1.default.getMime(path),
                    root: this.name
                });
                yield utils_1.default.toStream(content, writestream);
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
    getRepositorySsh() {
        return __awaiter(this, void 0, void 0, function* () {
            var registry = (yield this.engine.db.collection(this.name).find().toArray())[0];
            return registry.repository.ssh;
        });
    }
    getRepositoryUrl() {
        return __awaiter(this, void 0, void 0, function* () {
            var registry = (yield this.engine.db.collection(this.name).find().toArray())[0];
            return registry.repository.url.replace("https://", "https://oauth2:" + this.engine.gitLabAccessToken + "@");
        });
    }
    open(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            var repo = null;
            if (!fsextra.existsSync(this.path)) {
                repo = yield this.clone(socket);
                yield this.npminstall(socket);
            }
            else {
                repo = yield this.update(socket);
            }
            return repo;
        });
    }
    clone(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            socket.emit("log", "cloning...");
            try {
                var repossh = yield this.getRepositoryUrl();
                var repo = yield Git.Clone(repossh, this.path);
                socket.emit("log", "cloned");
                return repo;
            }
            catch (err) {
                console.log(err);
                socket.emit("log", err.message);
                throw err;
            }
        });
    }
    update(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            socket.emit("log", "updating...");
            var repo = yield Git.Repository.open(this.path);
            yield repo.fetchAll();
            var signature = this.getSignature();
            yield repo.mergeBranches("master", "origin/master", signature, null, { fileFavor: Git.Merge.FILE_FAVOR.THEIRS });
            socket.emit("log", "updated");
            return repo;
        });
    }
    npminstall(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            socket.emit("log", "npm install");
            var options = {
                path: this.path,
                forceInstall: false,
                npmLoad: {
                    loglevel: 'silent'
                }
            };
            return new Promise(function (resolve, reject) {
                npmi(options, function (err, result) {
                    if (err) {
                        if (err.code === npmi.LOAD_ERR) {
                            console.log('npm load error');
                            socket.emit("log", "npm install: load error");
                            reject(err);
                            return;
                        }
                        if (err.code === npmi.INSTALL_ERR) {
                            console.log('npm install error: ' + err.message);
                            socket.emit("log", "npm install: " + err.message);
                            reject(err);
                            return;
                        }
                        reject(err);
                        console.log(err.message);
                        socket.emit("log", "npm install: " + err.message);
                    }
                    resolve(result);
                    socket.emit("log", "npm install: ok");
                }.bind(this));
            }.bind(this));
        });
    }
    push(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                socket.emit("log", "pushing...");
                var repo = yield Git.Repository.open(this.path);
                yield gitkit.config.set(repo, {
                    'user.name': 'John Doe',
                    'user.email': 'johndoe@example.com'
                });
                var diff = yield gitkit.diff(repo);
                console.log(diff);
                yield gitkit.commit(repo, {
                    'message': 'commit message'
                });
                var log = yield gitkit.log(repo);
                console.log(log);
                var remote = yield Git.Remote.lookup(repo, "origin");
                if (remote == null) {
                    var repourl = yield this.getRepositoryUrl();
                    remote = yield Git.Remote.create(repo, "origin", repourl);
                }
                yield remote.push(["refs/heads/master:refs/heads/master"]);
                socket.emit("log", "pushed");
            }
            catch (err) {
                console.log(err);
            }
        });
    }
    getSignature() {
        return Git.Signature.create("Foo bar", "foo@bar.com", 123456789, 60);
    }
    getCompletionsAtPosition(msg) {
        const completions = this.languageService.getCompletionsAtPosition(msg.filePath, msg.position);
        let completionList = completions || {};
        completionList["entries"] = completionList["entries"] || [];
        let maxSuggestions = 1000;
        if (completionList["entries"].length > maxSuggestions)
            completionList["entries"] = completionList["entries"].slice(0, maxSuggestions);
        return completionList;
    }
    compile(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            if (socket)
                socket.emit("log", "Compile started...");
            let program = this.languageService.getProgram();
            let emitResult = program.emit(undefined, this.WriteFile.bind(this));
            let allDiagnostics = emitResult.diagnostics;
            allDiagnostics.forEach(diagnostic => {
                let { line, character } = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
                let message = ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
                socket.emit("log", `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`);
            });
            let success = !emitResult.emitSkipped;
            let exitCode = success ? "success" : "failed";
            socket.emit("log", "Compile finished: " + exitCode);
            return success;
        });
    }
    build(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            if (socket)
                socket.emit("log", "Build started...");
            return new Promise(function (resolve, reject) {
                try {
                    var configFile = fsextra.readFileSync(this.path + "/config/webpack.json");
                    var configStr = configFile.toString().replace(/\"\.\//gi, '"' + this.path + '/');
                    var config = JSON.parse(configStr);
                    var compiler = webpack(config);
                }
                catch (err) {
                    if (socket)
                        socket.emit("log", err.message);
                    resolve();
                    return;
                }
                compiler.run(function (err, stats) {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (err) {
                            socket.emit("log", err.message);
                            resolve();
                            return;
                        }
                        if (socket)
                            socket.emit("log", stats.toString());
                        if (stats.hasErrors()) {
                            socket.emit("log", "Build failed.");
                            resolve();
                            return;
                        }
                        if (socket)
                            socket.emit("log", "Build success.");
                        resolve();
                        return;
                    });
                }.bind(this));
            }.bind(this));
        });
    }
    publish(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            if (socket)
                socket.emit("log", "Publish started...");
            var paths = [];
            this.publishNode("dist", paths, socket);
            yield Promise.all(paths.map((path) => __awaiter(this, void 0, void 0, function* () { yield this.publishFile(path, socket); })));
            if (socket)
                socket.emit("log", "Publish success.");
        });
    }
    publishNode(path, paths, socket) {
        var stat = fsextra.lstatSync(this.path + '/' + path);
        if (stat.isFile()) {
            paths.push(path);
            return;
        }
        if (stat.isDirectory()) {
            var children = fsextra.readdirSync(this.path + '/' + path);
            for (var i in children) {
                var child = children[i];
                if (child[0] == '.')
                    continue;
                var childPath = (path) ? path + '/' + child : child;
                this.publishNode(childPath, paths, socket);
            }
            return;
        }
    }
    publishFile(path, socket) {
        return __awaiter(this, void 0, void 0, function* () {
            var buffer = fsextra.readFileSync(this.path + '/' + path);
            var pathToSave = path.substr(5);
            yield this.dbSaveFile(pathToSave, buffer, socket);
        });
    }
    loadFile(path) {
        var result = new model.fileInfo();
        result.buffer = fsextra.readFileSync(this.path + '/' + path);
        result.contentType = mime.lookup(path);
        this.engine.io.sockets.emit('log', path + " load: " + result.buffer.toString().length);
        return result;
    }
    getScriptVersion(fileName) {
        var stat = fsextra.lstatSync(this.path + "/" + fileName);
        var result = stat.mtime.toString();
        this.engine.io.sockets.emit('log', path + ": " + result);
        return result;
    }
    isFileExists(path) {
        var result = fsextra.existsSync(this.path + "/" + path);
        this.engine.io.sockets.emit('log', path + ": " + result);
        return result;
    }
    newFolder(msg, socket) {
        fsextra.mkdirpSync(this.path + '/' + msg.path);
        return this.createNode(msg.path);
    }
    newFile(msg, socket) {
        fsextra.writeFileSync(this.path + '/' + msg.path, "", { flag: 'w' });
        return this.createNode(msg.path);
    }
    createNode(relpath) {
        var node = {};
        node["filename"] = (relpath == '') ? this.name : path.basename(relpath);
        node["collapsed"] = (relpath != '');
        node["path"] = relpath;
        var stat = fsextra.lstatSync(this.path + '/' + relpath);
        if (stat.isFile()) {
            node["contentType"] = utils_1.default.getMime(relpath);
        }
        if (stat.isDirectory()) {
            node["contentType"] = "text/directory";
            node["children"] = [];
            var children = fsextra.readdirSync(this.path + '/' + relpath);
            children = children.sort();
            for (var i in children) {
                var child = children[i];
                if (child[0] == '.')
                    continue;
                if (child == 'node_modules')
                    continue;
                var childPath = (relpath) ? relpath + '/' + child : child;
                var childNode = this.createNode(childPath);
                node["children"].push(childNode);
            }
        }
        return node;
    }
    WriteFile(fileName, data, writeByteOrderMark, onError, sourceFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            fsextra.writeFileSync(this.path + "/" + fileName, data, { flag: 'w' });
        });
    }
}
exports.default = Application;
