
var errors = require("errno")
import * as mongodb from "mongodb"
import * as model from './model'
import * as gridfs from "gridfs-stream"
import * as mime from "mime"
import * as uuid from "node-uuid"
import Utils from './utils'

function MemoryFileSystemError(err, path) {
	Error.call(this)
	if (Error.captureStackTrace)
		Error.captureStackTrace(this, arguments.callee)
	this.code = err.code;
	this.errno = err.errno;
	this.message = err.description;
	this.path = path;
}
MemoryFileSystemError.prototype = new Error();

export default class MongoFS {

  private db: mongodb.Db
  private fscache: object

  constructor(db: mongodb.Db) {
    this.db = db
    this.fscache = {}
  }

  public async isDir(app: string, relpath: string) {
    var result = await this.findOrCreateStub(app, relpath, false)
    console.log("isDir " + relpath + " = " + (result.stub && result.stubType == "folder"))
    return result.stub && result.stubType == "folder"
  }

  public async isFile(app: string, relpath: string) {
    var result = await this.findOrCreateStub(app, relpath, false)
    console.log("isFile " + relpath + " = " + (result.stub && result.stubType == "file"))
    return result.stub && result.stubType == "file"
  }

  public async mkdirp(path: string, callback: (err: string, content: any) => any) {
    try {
      var fi = await this.uploadFileOrFolder(path, null)
      callback(null, null)
    }
    catch (err) {
      callback(err, null)
    }
  }

  public readFileSync (_path, encoding) {
    console.log("!!!!readFileSync!!!! " + _path)
    return ""
  }

  public access (_path, callback) {
    console.log("!!!!access!!!! " + _path)
    return ""
  }

  public async readJson(path: string, callback: (err: object, buffer: Uint8Array) => any) {   
    console.log("readJson " + path)
    try {
      var fi = await this.loadFile(path)
      var data = JSON.parse(fi.buffer.toString("utf-8"));
      callback(null, data)
    }
    catch (err) {
      err = {
        code: errors.code.ENOENT.code,
        errno: errors.code.ENOENT.errno,
        message: errors.code.ENOENT.description,
        path: path
      }
      callback(err, null)
    } 
  }

  public async readFile(path: string, callback: (err: object, buffer: Uint8Array) => any) {
    console.log("readfile " + path)
    try {
      var fi = await this.loadFile(path)
      callback(null, fi.buffer)
    }
    catch (err) {
      err = {
        code: errors.code.ENOENT.code,
        errno: errors.code.ENOENT.errno,
        message: errors.code.ENOENT.description,
        path: path
      }
      callback(err, null)
    } 
  }

  public async writeFile(path: string, content: any, callback: (err: object, content: any) => any) {
    try {
      var fi = await this.uploadFileOrFolder(path, content)
      callback(null, null)
    }
    catch (err) {
      callback(err, null)
    }
  }

  public readlink(path: string, callback: (err: object, result: any) => any) {
    console.log("readlink " + path)
    var err = {
      code: errors.code.ENOSYS.code,
      errno: errors.code.ENOSYS.errno,
      message: errors.code.ENOSYS.description,
      path: path
    }
    callback(err, null)
  }

  public async stat(path: string, callback: (err: object, stat: any) => any) {
    console.log("stat " + path)

    var ppath = this.parsePath(path)

    var trueFn = function () { return true; }
    var falseFn = function () { return false; }

    var err = null
    var stat = null

    if (await this.isDir(ppath.app, ppath.relpath)) {
      stat = {
        isFile: falseFn,
        isDirectory: trueFn,
        isBlockDevice: falseFn,
        isCharacterDevice: falseFn,
        isSymbolicLink: falseFn,
        isFIFO: falseFn,
        isSocket: falseFn
      }
    }

    if (await this.isFile(ppath.app, ppath.relpath)) {
      stat = {
        isFile: trueFn,
        isDirectory: falseFn,
        isBlockDevice: falseFn,
        isCharacterDevice: falseFn,
        isSymbolicLink: falseFn,
        isFIFO: falseFn,
        isSocket: falseFn
      }
    }

    if (!stat) {
      err = {
        code: errors.code.ENOENT.code,
        errno: errors.code.ENOENT.errno,
        message: errors.code.ENOENT.description,
        path: path
      }
    }

    callback(err, stat)
  }

  public normalize(path) {
    var parts = path.split(/(\\+|\/+)/);
    if (parts.length === 1)
      return path;
    var result: Array<string> = [];
    var absolutePathStart = 0;
    for (var i = 0, sep = false; i < parts.length; i++ , sep = !sep) {
      var part = parts[i];
      if (i === 0 && /^([A-Z]:)?$/i.test(part)) {
        result.push(part);
        absolutePathStart = 2;
      } else if (sep) {
        result.push(part[0]);
      } else if (part === "..") {
        switch (result.length) {
          case 0:
            // i. e. ".." => ".."
            // i. e. "../a/b/c" => "../a/b/c"
            result.push(part);
            break;
          case 2:
            // i. e. "a/.." => ""
            // i. e. "/.." => "/"
            // i. e. "C:\.." => "C:\"
            // i. e. "a/../b/c" => "b/c"
            // i. e. "/../b/c" => "/b/c"
            // i. e. "C:\..\a\b\c" => "C:\a\b\c"
            i++;
            sep = !sep;
            result.length = absolutePathStart;
            break;
          case 4:
            // i. e. "a/b/.." => "a"
            // i. e. "/a/.." => "/"
            // i. e. "C:\a\.." => "C:\"
            // i. e. "/a/../b/c" => "/b/c"
            if (absolutePathStart === 0) {
              result.length -= 3;
            } else {
              i++;
              sep = !sep;
              result.length = 2;
            }
            break;
          default:
            // i. e. "/a/b/.." => "/a"
            // i. e. "/a/b/../c" => "/a/c"
            result.length -= 3;
            break;
        }
      } else if (part === ".") {
        switch (result.length) {
          case 0:
            // i. e. "." => "."
            // i. e. "./a/b/c" => "./a/b/c"
            result.push(part);
            break;
          case 2:
            // i. e. "a/." => "a"
            // i. e. "/." => "/"
            // i. e. "C:\." => "C:\"
            // i. e. "C:\.\a\b\c" => "C:\a\b\c"
            if (absolutePathStart === 0) {
              result.length--;
            } else {
              i++;
              sep = !sep;
            }
            break;
          default:
            // i. e. "a/b/." => "a/b"
            // i. e. "/a/." => "/"
            // i. e. "C:\a\." => "C:\"
            // i. e. "a/./b/c" => "a/b/c"
            // i. e. "/a/./b/c" => "/a/b/c"
            result.length--;
            break;
        }
      } else if (part) {
        result.push(part);
      }
    }
    if (result.length === 1 && /^[A-Za-z]:$/.test(result[0]))
      return result[0] + "\\";
    return result.join("");
  }

  public join(path: string, request) {
    var absoluteWinRegExp = /^[A-Z]:([\\\/]|$)/i;
    var absoluteNixRegExp = /^\//i;

    if (!request) return this.normalize(path);
    if (absoluteWinRegExp.test(request)) return this.normalize(request.replace(/\//g, "\\"));
    if (absoluteNixRegExp.test(request)) return this.normalize(request);
    if (path == "/") return this.normalize(path + request);
    if (absoluteWinRegExp.test(path)) return this.normalize(path.replace(/\//g, "\\") + "\\" + request.replace(/\//g, "\\"));
    if (absoluteNixRegExp.test(path)) return this.normalize(path + "/" + request);
    return this.normalize(path + "/" + request);
  }

  //Find a fileStub in document based on the given filePath
  //stub, stubType, stubCreated
  public async findOrCreateStub(app: string, relpath: string, create: boolean): Promise<model.stubInfo> {
    var result = new model.stubInfo()
    relpath = relpath.replace(/\./g, '*');
    relpath = relpath.replace(/^(\/)/,"");
    result.stubType = (relpath.indexOf('*') != -1) ? "file" : "folder"

    var splitted = relpath.split('/')
    var fileName = ""
    var dirs = []

    //file stub?
    if (result.stubType == "file") {
      fileName = splitted[splitted.length - 1]
      dirs = splitted.slice(0, splitted.length - 1)
    }
    else {
      fileName = ""
      dirs = splitted.slice(0, splitted.length)
    }

    await this.loadFS(app)
    result.stub = this.fscache[app]["_attachments"]

    for (var i = 0; i < dirs.length; i++) {
      var dir = dirs[i]
      if (!result.stub[dir]) {
        if (!create) {
          result.stub = null
          return result
        } 
        result.stub[dir] = {}
        result.stubNew = true
      }
      result.stub = result.stub[dir]
    }

    if (result.stubType == "file") {
      if (!result.stub[fileName]) {
        if (!create) {
          result.stub = null
          return result
        }
        result.stub[fileName] = { _fileId: uuid.v1() }
        result.stubNew = true
      }
      result.stub = result.stub[fileName]
    }

    return result
  }

  private parsePath(path: string): parsedPath {
    var result = new parsedPath()
    result.app = path.substring(0, path.indexOf('/'))
    result.relpath = path.substring(path.indexOf('/'))
    return result
  }

  public async loadFile(path: string): Promise<model.fileInfo> {
    var ppath = this.parsePath(path)
    var result = await this.findOrCreateStub(ppath.app, ppath.relpath, false)
    if (!result.stub) {
      throw Error("not found")
    }

    var filedoc = await this.db.collection(ppath.app + ".files").findOne({ '_id': result.stub._fileId })

    var gfs = gridfs(this.db, mongodb);
    var readstream = gfs.createReadStream({
      _id: filedoc._id,
      root: ppath.app
    });

    try {
      var buffer = await Utils.fromStream(readstream)
      return { contentType: filedoc.contentType, buffer: buffer }
    }
    catch (err) {
      throw Error(err.message)
    }
  }

  public async uploadFileOrFolder(path: string, data: any): Promise<model.stubInfo> {
    var ppath = this.parsePath(path)

    if (ppath.relpath == "controller.js") {
      var F = Function('app', data)
    }

    var result = await this.findOrCreateStub(ppath.app, ppath.relpath, true)
    if (result.stubNew) {
      await this.saveFS(ppath.app)
    }

    if (result.stubType == "folder") return result

    if (result.stubType == "file") {
      //if (!s.stubNew){
      //    try{
      //        await this.removeFile(s.fileId) //delete old version
      //    }catch(e){}
      //}
      await this.createFile(result.stub._fileId, ppath.app, ppath.relpath, data)
      return result
    }
  }

  public async loadFS(app: string) {
    if (this.fscache[app]) return
    this.fscache[app] = await this.db.collection(app).findOne({ _id: "fs" })
  }

  public async saveFS(app: string) {
    await this.db.collection(app).updateOne({ _id: "fs" }, this.fscache[app], { w: 1 })
  }

  public async createFile(id: string, app: string, relpath: string, data: any): Promise<Object> {
    var gfs = gridfs(this.db, mongodb);
    var writestream = gfs.createWriteStream({
      _id: id,
      filename: id,
      root: app,
      content_type: mime.lookup(relpath)
    });
    return await Utils.toStream(data, writestream)
  }

  public async deleteFile(id: string, app: string) {
    var gfs = gridfs(this.db, mongodb);
    gfs.remove({
      _id: id,
      root: app
    }, function (err) {
      console.log(err)
    });
  }

  public async garbageFiles(app: string) {
    await this.loadFS(app)
    var a = JSON.stringify(this.fscache[app]["_attachments"])
    var b = a.split("_fileId\":\"")
    var c = b.map(function (value) {
      return value.substr(0, 36)
    })
    var d = c.slice(1)

    await this.db.collection(app + ".files").remove({ '_id': { $nin: d } })
    await this.db.collection(app + ".chunks").remove({ 'files_id': { $nin: d } })
  }
}

class parsedPath {
    app: string
    relpath: string
}
