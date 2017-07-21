"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pathhelper = require("path");
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
    static getMime(path) {
        var ext = pathhelper.extname(path);
        if (ext == ".ts")
            return "application/typescript";
        if (ext == ".tsx")
            return "application/typescript";
        return mime.lookup(path);
    }
}
Utils.parseUrl = function (url) {
    var pos = url.split('/', 2).join('/').length;
    return {
        app: url.substr(1, pos - 1),
        url: url.substr(pos)
    };
};
exports.default = Utils;
