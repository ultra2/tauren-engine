"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const request = require("request");
const mime = require("mime");
class Utils {
    static fromStream(stream) {
        return new Promise((resolve, reject) => {
            var buffer;
            stream.on('data', function (data) {
                if (buffer == null) {
                    buffer = data;
                    return;
                }
                buffer += data;
            });
            stream.on('end', () => resolve(buffer));
            stream.on('error', (err) => reject(err));
        });
    }
    static toStream(data, writestream) {
        writestream.write(data);
        writestream.end();
        return new Promise(function (resolve, reject) {
            writestream.on('close', function (result) {
                resolve(result);
            });
            writestream.on('error', function (err) {
                reject(err.message);
            });
        });
    }
    static callService(uri, options) {
        return new Promise((resolve, reject) => {
            options = options || {};
            options.headers = options.headers || {};
            options.headers['user-agent'] = 'node.js';
            request(uri, options, function (err, resp, body) {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(body);
            });
        });
    }
    static createInstanceFromJson(objType, json) {
        const newObj = new objType();
        const relationships = objType["relationships"] || {};
        for (const prop in json) {
            if (json.hasOwnProperty(prop)) {
                if (newObj[prop] == null) {
                    if (relationships[prop] == null) {
                        newObj[prop] = json[prop];
                    }
                    else {
                        newObj[prop] = this.createInstanceFromJson(relationships[prop], json[prop]);
                    }
                }
                else {
                    console.warn(`Property ${prop} not set because it already existed on the object.`);
                }
            }
        }
        return newObj;
    }
    static normalize(path) {
        var parts = path.split(/(\\+|\/+)/);
        if (parts.length === 1)
            return path;
        var result = [];
        var absolutePathStart = 0;
        for (var i = 0, sep = false; i < parts.length; i++, sep = !sep) {
            var part = parts[i];
            if (i === 0 && /^([A-Z]:)?$/i.test(part)) {
                result.push(part);
                absolutePathStart = 2;
            }
            else if (sep) {
                result.push(part[0]);
            }
            else if (part === "..") {
                switch (result.length) {
                    case 0:
                        result.push(part);
                        break;
                    case 2:
                        i++;
                        sep = !sep;
                        result.length = absolutePathStart;
                        break;
                    case 4:
                        if (absolutePathStart === 0) {
                            result.length -= 3;
                        }
                        else {
                            i++;
                            sep = !sep;
                            result.length = 2;
                        }
                        break;
                    default:
                        result.length -= 3;
                        break;
                }
            }
            else if (part === ".") {
                switch (result.length) {
                    case 0:
                        result.push(part);
                        break;
                    case 2:
                        if (absolutePathStart === 0) {
                            result.length--;
                        }
                        else {
                            i++;
                            sep = !sep;
                        }
                        break;
                    default:
                        result.length--;
                        break;
                }
            }
            else if (part) {
                result.push(part);
            }
        }
        if (result.length === 1 && /^[A-Za-z]:$/.test(result[0]))
            return result[0] + "\\";
        return result.join("");
    }
    static join(path, request) {
        var absoluteWinRegExp = /^[A-Z]:([\\\/]|$)/i;
        var absoluteNixRegExp = /^\//i;
        if (!request)
            return this.normalize(path);
        if (absoluteWinRegExp.test(request))
            return this.normalize(request.replace(/\//g, "\\"));
        if (absoluteNixRegExp.test(request))
            return this.normalize(request);
        if (path == "/")
            return this.normalize(path + request);
        if (absoluteWinRegExp.test(path))
            return this.normalize(path.replace(/\//g, "\\") + "\\" + request.replace(/\//g, "\\"));
        if (absoluteNixRegExp.test(path))
            return this.normalize(path + "/" + request);
        return this.normalize(path + "/" + request);
    }
    static getExt(path) {
        var re = /(?:\.([^.]+))?$/;
        return re.exec(path)[1];
    }
    static getMime(path) {
        var ext = this.getExt(path);
        if (ext == "ts")
            return "application/typescript";
        if (ext == "tsx")
            return "application/typescript";
        return mime.lookup(path);
    }
}
exports.default = Utils;
