"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments)).next());
    });
};
const uuid = require("node-uuid");
const DBContext_1 = require('./DBContext');
const Application_1 = require('./Application');
class Engine {
    constructor() {
        this.applications = {};
    }
    loadApplications() {
        return __awaiter(this, void 0, void 0, function* () {
            var data = yield DBContext_1.default.db.listCollections({}).toArray();
            data.forEach(function (element, index) {
                return __awaiter(this, void 0, void 0, function* () {
                    var name = element.name.split('.')[0];
                    if (name == "system")
                        return;
                    if (this.applications[name])
                        return;
                    var app = new Application_1.default(name, this);
                    this.applications[name] = app;
                    yield app.load();
                });
            }.bind(this));
        });
    }
    createApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            var app = new Application_1.default(name, this);
            var fileId = uuid.v1();
            yield DBContext_1.default.db.collection(name).insertOne({
                _id: "client",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            yield DBContext_1.default.db.collection(name).insertOne({
                _id: "server",
                _attachments: {}
            }, { w: 1, checkKeys: false });
            yield app.createFile(fileId, "index.html", "hello");
            return app;
        });
    }
    deleteApplication(name) {
        return __awaiter(this, void 0, void 0, function* () {
            yield DBContext_1.default.db.collection(name).drop();
            yield DBContext_1.default.db.collection(name + ".files").drop();
            yield DBContext_1.default.db.collection(name + ".chunks").drop();
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Engine;
