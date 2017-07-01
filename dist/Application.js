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
const uuid = require("node-uuid");
const fsextra = require("fs-extra");
const mime = require("mime");
const JSZip = require("jszip");
const webpack = require("webpack");
const utils_1 = require("./utils");
const model = require("./model");
const ts = require("typescript");
const LanguageServiceHost_1 = require("./LanguageServiceHost");
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
                var buffer = yield this.dbLoadFileByName("controller.js");
                var F = Function('app', buffer);
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
    open(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createTree();
            yield this.cache2(socket);
            yield this.npminstall();
            yield this.compile(socket);
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
    createTempDir() {
        var projectpath = "/tmp/virtual/" + this.name;
        fsextra.ensureDirSync(projectpath);
    }
    cache(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            this.createTempDir();
            socket.emit("log", "Caching...");
            var fs = yield this.loadDocument("fs");
            this.paths = [];
            yield this.cacheStub(fs._attachments, "/" + this.name);
            yield Promise.all(this.paths.map((path) => __awaiter(this, void 0, void 0, function* () { yield this.cacheFile(path); })));
            socket.emit("log", "Caching finished. Files count: " + this.paths.length);
        });
    }
    cacheStub(fileStub, path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (path.indexOf('.') == -1) {
                this.engine.cache.mkdirpSync(path);
                fsextra.mkdirpSync("/tmp/virtual/" + path);
                for (var key in fileStub) {
                    yield this.cacheStub(fileStub[key], path + "/" + key);
                }
            }
            else {
                this.paths.push(path);
                this.pathversions["/virtual" + path] = { version: 0 };
            }
        });
    }
    cacheFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var fileinfo = yield this.engine.mongo.loadFile(path);
            if (path[0] != '/')
                path = '/' + path;
            this.engine.cache.writeFileSync(path, fileinfo.buffer);
            fsextra.writeFileSync("/tmp/virtual/" + path, fileinfo.buffer, { flag: 'w' });
            this.pathversions["/virtual" + path].version++;
        });
    }
    cache2(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            this.createTempDir();
            if (socket)
                socket.emit("log", "Caching...");
            yield Promise.all(this.filesArray.map((file) => __awaiter(this, void 0, void 0, function* () { yield this.cacheFile2(file); })));
            if (socket)
                socket.emit("log", "Caching finished. Files/Folders count: " + this.filesArray.length);
        });
    }
    cacheFile2(file) {
        return __awaiter(this, void 0, void 0, function* () {
            if (file.contentType == "text/directory") {
                fsextra.mkdirpSync(this.path + '/' + file.path);
                return;
            }
            var buffer = yield this.dbLoadFileById(file._id);
            fsextra.writeFileSync(this.path + '/' + file.path, buffer, { flag: 'w' });
        });
    }
    findFile(path) {
        var files = this.filesArray.filter(file => file.path === path);
        if (files.length == 0) {
            return undefined;
        }
        return files[0];
    }
    findFileById(_id) {
        var files = this.filesArray.filter(file => file._id === _id);
        if (files.length == 0) {
            return undefined;
        }
        return files[0];
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
    dbLoadFileByName(filename) {
        return __awaiter(this, void 0, void 0, function* () {
            var readstream = this.engine.gridfs.createReadStream({
                filename: filename,
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
    createTree() {
        return __awaiter(this, void 0, void 0, function* () {
            this.filesArray = yield this.engine.db.collection(this.name + ".files").find().toArray();
            this.filesRoot = this.filesArray.filter(file => file.metadata.parent_id === null)[0];
            this.createTreeChildren(this.filesRoot, '');
        });
    }
    createTreeChildren(node, path) {
        node.path = path;
        if (node.contentType == "text/directory") {
            node.children = this.filesArray.filter(file => file.metadata.parent_id === node._id);
            for (var i in node.children) {
                var child = node.children[i];
                var childPath = (node.path) ? node.path + '/' + child.filename : child.filename;
                this.createTreeChildren(child, childPath);
            }
        }
    }
    npminstall() {
        return __awaiter(this, void 0, void 0, function* () {
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
                            reject(err);
                            return;
                        }
                        if (err.code === npmi.INSTALL_ERR) {
                            console.log('npm install error: ' + err.message);
                            reject(err);
                            return;
                        }
                        reject(err);
                        return console.log(err.message);
                    }
                    resolve(result);
                }.bind(this));
            }.bind(this));
        });
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
            let exitCode = emitResult.emitSkipped ? "failed" : "success";
            socket.emit("log", "Compile finished: " + exitCode);
        });
    }
    build(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            if (socket)
                socket.emit("log", "Build started...");
            return new Promise(function (resolve, reject) {
                try {
                    var configFile = fsextra.readFileSync("/tmp/virtual/" + this.name + "/config/webpack.json");
                    var configStr = configFile.toString().replace(/\"\.\//gi, '"' + '/tmp/virtual/' + this.name + '/');
                    var config = JSON.parse(configStr);
                    var compiler = webpack(config);
                }
                catch (err) {
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
                        socket.emit("log", stats.toString());
                        if (stats.hasErrors()) {
                            socket.emit("log", "Build failed.");
                            resolve();
                            return;
                        }
                        var buffer = fsextra.readFileSync(config.output.path + '/' + config.output.filename);
                        yield this.engine.mongo.uploadFileOrFolder(config.output.path.substr('/tmp/virtual/'.length) + '/' + config.output.filename, buffer);
                        socket.emit("log", "Build success.");
                        resolve();
                        return;
                    });
                }.bind(this));
            }.bind(this));
        });
    }
    loadFile(path) {
        var result = new model.fileInfo();
        result.buffer = fsextra.readFileSync("/tmp/virtual/" + path);
        result.contentType = mime.lookup(path);
        return result;
    }
    loadFile2(path) {
        return __awaiter(this, void 0, void 0, function* () {
            path = path.replace("studio42/", "");
            var result = new model.fileInfo();
            result.buffer = fsextra.readFileSync(this.path + '/' + path);
            result.contentType = mime.lookup(path);
            return result;
        });
    }
    loadFile3(path) {
        path = path.replace("studio42/", "");
        var result = new model.fileInfo();
        result.buffer = fsextra.readFileSync(this.path + '/' + path);
        result.contentType = mime.lookup(path);
        return result;
    }
    getScriptVersion(fileName) {
        var stat = fsextra.lstatSync(this.path + "/" + fileName);
        return stat.mtime.toString();
    }
    isFileExists(path) {
        return fsextra.existsSync(this.path + "/" + path);
    }
    dbUpdateFileContentById(_id, content, socket) {
        return __awaiter(this, void 0, void 0, function* () {
            var file = this.findFileById(_id);
            file["root"] = this.name;
            file.metadata.version += 1;
            var writestream = this.engine.gridfs.createWriteStream(file);
            yield utils_1.default.toStream(content, writestream);
            fsextra.writeFileSync(this.path + '/' + file.path, content, { flag: 'w' });
        });
    }
    dbCreateFolder(msg, socket) {
        return __awaiter(this, void 0, void 0, function* () {
            var _id = uuid.v1();
            var writestream = this.engine.gridfs.createWriteStream({
                _id: _id,
                filename: msg.filename,
                content_type: "text/directory",
                metadata: {
                    parent_id: msg.parent_id,
                    version: 0
                },
                root: this.name
            });
            yield utils_1.default.toStream("", writestream);
            return _id;
        });
    }
    dbCreateFile(msg, socket) {
        return __awaiter(this, void 0, void 0, function* () {
            var _id = uuid.v1();
            var writestream = this.engine.gridfs.createWriteStream({
                _id: _id,
                filename: msg.filename,
                content_type: utils_1.default.getMime(msg.filename),
                metadata: {
                    parent_id: msg.parent_id,
                    version: 0
                },
                root: this.name
            });
            yield utils_1.default.toStream("", writestream);
            return _id;
        });
    }
    WriteFile(fileName, data, writeByteOrderMark, onError, sourceFiles) {
        return __awaiter(this, void 0, void 0, function* () {
            fsextra.writeFileSync(this.path + "/" + fileName, data, { flag: 'w' });
        });
    }
}
exports.default = Application;
