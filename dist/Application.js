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
const pathhelper = require("path");
const moment = require("moment");
const uuid = require("node-uuid");
const fsextra = require("fs-extra");
const utils_1 = require("./utils");
var cp = require('child_process');
var npmi = require('npmi');
var Git = require("nodegit");
var gitkit = require('nodegit-kit');
class Application {
    constructor(application, engine) {
        this.name = application;
        this.path = "/tmp/repos/" + this.name;
        this.engine = engine;
        this.livePath = this.engine.livePath + '/' + this.name;
    }
    run() {
        var pkg = fsextra.readFileSync(this.livePath + "/package.json");
        var pkgobj = JSON.parse(pkg.toString());
        process.execArgv = []; //DEBUG: ["--debug-brk=9229"] 
        //process.execArgv = ["--inspect=9229"] 
        var modulePath = pkgobj["main"] || "dist/server/start";
        var cwd = this.livePath;
        var pos = modulePath.lastIndexOf('/');
        //if (pos != -1){
        //    cwd += '/' + modulePath.substr(0, pos)
        //    modulePath = modulePath.substr(pos+1)
        //} 
        this.port = this.engine.getFreePort();
        var args = []; //DEBUG: ["--debug-brk=9229"] 
        var options = { cwd: cwd, env: { workingUrl: this.engine.workingUrl, PORT: this.port } };
        this.process = cp.fork(modulePath, args, options);
        this.process.on('message', this.onMessage.bind(this));
    }
    onMessage(message) {
        console.log(message);
        switch (message.command) {
            case "applications":
                this.applications(message.data);
                break;
            case "update":
                this.onUpdate(message.data);
                break;
            case "install":
                this.onInstall(message.data);
                break;
            case "uninstall":
                this.onUninstall(message.data);
                break;
        }
    }
    applications(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var applications = Object.keys(this.engine.applications);
            this.process.send({ command: "applications", data: applications });
        });
    }
    onUpdate(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = this.engine.applications[data.app];
            app.updateFromGit();
        });
    }
    onInstall(data) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = yield this.engine.install(data.name, data.url);
            yield app.run();
        });
    }
    onUninstall(data) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.engine.uninstall(data.name);
        });
    }
    installFromDb() {
        return __awaiter(this, void 0, void 0, function* () {
            //if (fsextra.pathExistsSync(this.livePath)) return
            fsextra.ensureDirSync(this.livePath);
            var files = this.engine.db.collection("studio44.files").find();
            var filesArray = yield files.toArray();
            yield Promise.all(filesArray.map((file) => __awaiter(this, void 0, void 0, function* () { yield this.installFileFromDb(file.filename); })));
            yield this.npminstall();
        });
    }
    installFileFromDb(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var readstream = this.engine.gridfs.createReadStream({
                filename: path,
                root: this.name
            });
            var buffer = yield utils_1.default.fromStream(readstream);
            var fullPath = this.livePath + '/' + path;
            fsextra.ensureDirSync(pathhelper.dirname(fullPath));
            fsextra.writeFileSync(fullPath, buffer, { flag: 'w' });
            console.log("writeFileSync: " + fullPath);
        });
    }
    cloneFromGit(url) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("clone...");
                //var url = await this.getRepositoryUrl()
                //var cloneOptions = { fetchOpts: { callbacks: this.engine.getRemoteCallbacks() } }
                var repo = yield Git.Clone(url, this.livePath);
                console.log("clone success");
                return repo;
            }
            catch (err) {
                console.log(err);
                throw err;
            }
        });
    }
    updateFromGit() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(this.name + " update...");
            var repo = yield Git.Repository.open(this.livePath);
            yield repo.fetchAll();
            var signature = this.getSignature();
            yield repo.mergeBranches("master", "origin/master", signature, null, { fileFavor: Git.Merge.FILE_FAVOR.THEIRS });
            console.log(this.name + " update success");
            return repo;
        });
    }
    getSignature() {
        return Git.Signature.create("Foo bar", "foo@bar.com", 123456789, 60);
    }
    getRepositorySsh() {
        return __awaiter(this, void 0, void 0, function* () {
            var registry = (yield this.engine.db.collection(this.name).find().toArray())[0];
            return registry.repository.ssh;
        });
    }
    //public async getRepositoryUrl(): Promise<string> {
    //var registry = (await this.engine.db.collection(this.name).find().toArray())[0]
    //    var registry = { repository: { url: "https://gitlab.com/ultra2/" + this.name + ".git" } }
    //    return registry.repository.url.replace("https://", "https://oauth2:" + this.engine.gitLabAccessToken + "@")
    //}
    npminstall() {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(this.name + " npm install...");
            var options = {
                //name: 'react-split-pane',	// your module name
                //version: '3.10.9',		// expected version [default: 'latest']
                path: this.livePath,
                forceInstall: false,
                npmLoad: {
                    loglevel: 'warn' // [default: {loglevel: 'silent'}]
                }
            };
            function donpminstall(resolve, reject) {
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
                        console.log('npm install error: ' + err.message);
                        reject(err);
                    }
                    console.log(this.name + " npm install success");
                    resolve(result);
                }.bind(this));
            }
            return new Promise(donpminstall.bind(this));
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
                var result = new FileInfo();
                //contentType
                var filedesc = yield this.engine.db.collection(this.name + ".files").findOne({ filename: path });
                result.contentType = filedesc.contentType;
                result.metadata = filedesc.metadata;
                //buffer
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
                    metadata: {
                        modified: moment().format('YYYY-MM-DD HH:mm:ss Z')
                    },
                    root: this.name
                });
                yield utils_1.default.toStream(content, writestream);
            }
            catch (err) {
                throw Error(err.message);
            }
        });
    }
}
exports.default = Application;
class FileInfo {
}
