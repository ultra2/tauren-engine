"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
class Model {
    constructor(jsonObj) {
        if (jsonObj) {
            for (var propName in jsonObj) {
                this[propName] = jsonObj[propName];
            }
        }
    }
}
exports.Model = Model;
class stubInfo {
}
exports.stubInfo = stubInfo;
class fileInfo {
}
exports.fileInfo = fileInfo;
