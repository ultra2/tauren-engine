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
class DBContext {
    static initMongo() {
        return __awaiter(this, void 0, void 0, function* () {
            var url = (process.env["OPENSHIFT_MONGODB_DB_URL"]) ? process.env["OPENSHIFT_MONGODB_DB_URL"] : "mongodb://admin:Leonardo19770206Z@ds117189.mlab.com:17189/ide";
            try {
                this.db = yield mongodb.MongoClient.connect(url);
                console.log("Mongo initialized!");
            }
            catch (err) {
                console.log('Mongo error: ', err.message);
            }
        });
    }
}
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = DBContext;
