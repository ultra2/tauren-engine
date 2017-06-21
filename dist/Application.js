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
const fsextra = require("fs-extra");
const mime = require("mime");
const JSZip = require("jszip");
const utils_1 = require("./utils");
const model = require("./model");
const ts = require("typescript");
const LanguageServiceHost_1 = require("./LanguageServiceHost");
var npmi = require('npmi');
class Application {
    constructor(application, engine) {
        this.fs = {};
        this.paths = [];
        this.pathversions = {};
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
            this.languageServiceHost = new LanguageServiceHost_1.default(this);
            this.languageService = ts.createLanguageService(this.languageServiceHost, ts.createDocumentRegistry());
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
    cache(socket) {
        return __awaiter(this, void 0, void 0, function* () {
            var virtualpath = "/tmp/virtual";
            if (!fsextra.existsSync(virtualpath)) {
                console.log("create " + virtualpath);
                fsextra.mkdirSync(virtualpath);
            }
            else {
                console.log("exists " + virtualpath);
            }
            var projectpath = "/tmp/virtual/" + this.name;
            if (!fsextra.existsSync(projectpath)) {
                console.log("create " + projectpath);
                fsextra.mkdirSync(projectpath);
            }
            else {
                console.log("exists " + projectpath);
            }
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
                if (!this.isCachable(path))
                    return;
                this.paths.push(path);
                this.pathversions["/virtual" + path] = { version: 0 };
            }
        });
    }
    getExt(path) {
        var re = /(?:\.([^.]+))?$/;
        return re.exec(path)[1];
    }
    isCachable(path) {
        return true;
    }
    cacheFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isCachable(path))
                return;
            var fileinfo = yield this.engine.mongo.loadFile(path);
            if (path[0] != '/')
                path = '/' + path;
            this.engine.cache.writeFileSync(path, fileinfo.buffer);
            fsextra.writeFileSync("/tmp/virtual/" + path, fileinfo.buffer);
            this.pathversions["/virtual" + path].version++;
        });
    }
    npminstall() {
        return __awaiter(this, void 0, void 0, function* () {
            var projectpath = "/tmp/virtual/" + this.name;
            var options = {
                path: projectpath,
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
        const completions = this.languageService.getCompletionsAtPosition('/virtual/' + this.name + msg.filePath, msg.position);
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
    loadFile(path) {
        var result = new model.fileInfo();
        result.buffer = fsextra.readFileSync("/tmp/virtual/" + path);
        result.contentType = mime.lookup(path);
        return result;
    }
    WriteFile(fileName, data, writeByteOrderMark, onError, sourceFiles) {
        this.engine.mongo.uploadFileOrFolder(this.name + "/" + fileName, data);
        fsextra.writeFileSync("/tmp/virtual/" + this.name + "/" + fileName, data);
    }
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            return { message: "build" };
        });
    }
}
exports.default = Application;
