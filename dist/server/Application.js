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
const uuid = require("uuid");
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
        this.process.on('message', function (message) {
            this.engine.onMessage(this.name, message.command, message.data);
        }.bind(this));
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
    cloneFromGit(url, accessToken) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log("clone...");
                var cloneOptions = {};
                if (accessToken) {
                    if (url.indexOf('github.com') != -1) {
                        cloneOptions = { fetchOpts: { callbacks: this.getRemoteCallbacks(accessToken) } };
                    }
                    if (url.indexOf('gitlab.com') != -1) {
                        url = url.replace("https://", "https://oauth2:" + accessToken + "@");
                    }
                }
                var repo = yield Git.Clone(url, this.livePath, cloneOptions);
                console.log("clone success");
                return repo;
            }
            catch (err) {
                console.log(err);
                throw err;
            }
        });
    }
    getRemoteCallbacks(accessToken) {
        var counter = 0;
        return {
            certificateCheck: function () { return 1; },
            credentials: function () {
                if (counter > 0) {
                    return Git.Cred.defaultNew();
                }
                counter++;
                return Git.Cred.userpassPlaintextNew(accessToken, "x-oauth-basic");
            }.bind(this)
        };
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
    pushToGit(app) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                console.log(this.name + " push...");
                this.engine.appStateChanged(this.name, "pushing");
                var repo = yield Git.Repository.open(this.livePath);
                yield gitkit.config.set(repo, {
                    'user.name': 'John Doe',
                    'user.email': 'johndoe@example.com'
                });
                var diff = yield gitkit.diff(repo);
                //console.log(diff)
                yield gitkit.commit(repo, {
                    'message': 'commit message'
                });
                var log = yield gitkit.log(repo);
                //console.log(log)
                //index
                //var index = await repo.refreshIndex()
                //var index = await repo.index()
                //var a = await index.removeAll()
                //var a2 =await index.addAll()
                //var a3 =await index.write()
                //var oid = await index.writeTree()
                //commit
                //await repo.createCommit("HEAD", signature, signature, "initial commit", oid, [])
                //remote
                var remote = yield Git.Remote.lookup(repo, "origin");
                if (remote == null) {
                    //var repourl = await this.getRepositoryUrl(app)
                    //remote = await Git.Remote.create(repo, "origin", repourl)
                }
                //push
                //await remote.push(["refs/heads/master:refs/heads/master"], { callbacks: this.engine.getRemoteCallbacks() })
                var accessToken = "ff1bea1d5d1cd623e3baab0f5a37162873e8107a";
                var pushOptions = {};
                var url = remote.url();
                if (url.indexOf('github.com') != -1) {
                    pushOptions = { callbacks: this.getRemoteCallbacks(accessToken) };
                }
                else {
                    url = url.replace("https://", "https://oauth2:" + accessToken + "@");
                }
                yield remote.push(["refs/heads/master:refs/heads/master"], pushOptions);
                console.log(this.name + " push success");
                this.engine.appStateChanged(this.name, "pushed");
            }
            catch (err) {
                console.log(err);
            }
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
