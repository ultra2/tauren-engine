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
class Application {
    constructor(application, engine) {
        this.name = application;
        this.path = "/tmp/repos/" + this.name;
        this.livePath = "/tmp/live/" + this.name;
        this.engine = engine;
    }
    init() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                this.createChildProcess();
                yield this.install();
            }
            catch (err) {
                console.log("Application could not been loaded: " + this.name + ", " + err);
            }
        });
    }
    createChildProcess() {
        process.execArgv = []; //DEBUG: ["--debug-brk=9229"] 
        //process.execArgv = ["--inspect=9229"] 
        var modulePath = "dist/server/start";
        var args = []; //DEBUG: ["--debug-brk=9229"] 
        var options = { cwd: this.path, env: { workingUrl: this.engine.workingUrl } };
        this.process = cp.fork(modulePath, args, options);
    }
    install() {
        return __awaiter(this, void 0, void 0, function* () {
            //if (fsextra.pathExistsSync(this.livePath)) return
            fsextra.ensureDirSync(this.livePath);
            var filesArray = yield this.engine.db.collection(this.name + ".files").find().toArray();
            yield Promise.all(filesArray.map((file) => __awaiter(this, void 0, void 0, function* () { yield this.installFile(file.filename); })));
            yield this.npminstall();
        });
    }
    installFile(path) {
        return __awaiter(this, void 0, void 0, function* () {
            var readstream = this.engine.gridfs.createReadStream({
                filename: path,
                root: this.name
            });
            var buffer = yield utils_1.default.fromStream(readstream);
            var fullPath = this.livePath + '/' + path;
            fsextra.ensureDirSync(pathhelper.dirname(fullPath));
            fsextra.writeFileSync(fullPath, buffer, { flag: 'w' });
        });
    }
    npminstall() {
        return __awaiter(this, void 0, void 0, function* () {
            var options = {
                //name: 'react-split-pane',	// your module name
                //version: '3.10.9',		// expected version [default: 'latest']
                path: this.livePath,
                forceInstall: false,
                npmLoad: {
                    loglevel: 'silent' // [default: {loglevel: 'silent'}]
                }
            };
            function install(resolve, reject) {
                npmi(options, function (err, result) {
                    if (err) {
                        if (err.code === npmi.LOAD_ERR) {
                            console.log('npm load error');
                            this.emit("log", "npm install: load error", "main");
                            reject(err);
                            return;
                        }
                        if (err.code === npmi.INSTALL_ERR) {
                            console.log('npm install error: ' + err.message);
                            this.emit("log", "npm install: " + err.message, "main");
                            reject(err);
                            return;
                        }
                        reject(err);
                        console.log(err.message);
                        this.emit("log", "npm install: " + err.message, "main");
                    }
                    resolve(result);
                }.bind(this));
            }
            return new Promise(install.bind(this));
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
