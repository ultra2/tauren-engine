"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fibers = require("fibers");
class MongoSyncFS {
    constructor(application, db) {
        this.application = application;
        this.db = db;
    }
    loadFS() {
        if (this.fsobj)
            return;
        fibers(function () {
            var fiber = fibers.current;
            setTimeout(function () {
                fiber.run();
            }, 15000);
            console.log("before yield");
            fibers.yield(0);
            console.log("after yield");
        }).run();
        console.log(this.fsobj);
    }
}
exports.default = MongoSyncFS;
