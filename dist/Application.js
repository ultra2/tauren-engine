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
const moment = require("moment");
const uuid = require("node-uuid");
const utils_1 = require("./utils");
var cp = require('child_process');
var npmi = require('npmi');
class Application {
    constructor(application, engine) {
        this.name = application;
        this.path = "/tmp/repos/" + this.name;
        this.engine = engine;
    }
    init() {
        try {
            this.createChildProcess();
            //await this.cacheServer()
        }
        catch (err) {
            console.log("Application could not been loaded: " + this.name + ", " + err);
        }
    }
    createChildProcess() {
        //process.execArgv = [] //DEBUG: ["--debug-brk=9229"] 
        process.execArgv = ["--inspect=9229"];
        var modulePath = "dist/server/start";
        var args = []; //DEBUG: ["--debug-brk=9229"] 
        var options = { cwd: this.path, env: { workingUrl: this.engine.workingUrl } };
        this.process = cp.fork(modulePath, args, options);
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
