"use strict";

import Engine from './Engine'
import * as pathhelper from 'path'
import * as mongodb from "mongodb"
import * as moment from 'moment'
import * as uuid from "node-uuid"
import * as fsextra from 'fs-extra'
import Utils from './utils'

var cp = require('child_process')
var npmi = require('npmi')

export default class Application {

    public engine: Engine
    public name: string
    public path: string
    public livePath: string
    public process: any
    
    constructor(application: string, engine: Engine) {
        this.name = application
        this.path = "/tmp/repos/" + this.name
        this.livePath = "/tmp/live/" + this.name
        this.engine = engine
    }

    public async init() {
        try {
            this.createChildProcess()
            await this.install()
        }
        catch (err) {
            console.log("Application could not been loaded: " + this.name + ", " + err);
        }
    }

    public createChildProcess(){
        process.execArgv = [] //DEBUG: ["--debug-brk=9229"] 
        //process.execArgv = ["--inspect=9229"] 
        var modulePath = "dist/server/start"
        var args = []  //DEBUG: ["--debug-brk=9229"] 
        var options = { cwd: this.path, env: { workingUrl: this.engine.workingUrl } }
        this.process = cp.fork(modulePath, args, options)
    }

    public async install(){
        //if (fsextra.pathExistsSync(this.livePath)) return
        fsextra.ensureDirSync(this.livePath)
        var filesArray = await this.engine.db.collection(this.name + ".files").find().toArray()
        await Promise.all(filesArray.map(async file => { await this.installFile(file.filename) }))
        await this.npminstall()
    }
   
    public async installFile(path: string): Promise<void> {
        var readstream = this.engine.gridfs.createReadStream({
            filename: path,
            root: this.name
        })
        var buffer = await Utils.fromStream(readstream)
        var fullPath = this.livePath + '/' + path
        fsextra.ensureDirSync(pathhelper.dirname(fullPath))
        fsextra.writeFileSync(fullPath, buffer, { flag: 'w' });
    }

    public async npminstall() {

        var options = {
	        //name: 'react-split-pane',	// your module name
            //version: '3.10.9',		// expected version [default: 'latest']
	        path: this.livePath,			// installation path [default: '.']
	        forceInstall: false,	        // force install if set to true (even if already installed, it will do a reinstall) [default: false]
            npmLoad: {				    // npm.load(options, callback): this is the "options" given to npm.load()
                loglevel: 'silent'	    // [default: {loglevel: 'silent'}]
            }
        }

        function install (resolve, reject) {
            npmi(options, function (err, result) {
                if (err) {
                    if (err.code === npmi.LOAD_ERR) {
                        console.log('npm load error')
                        this.emit("log", "npm install: load error", "main")
                        reject(err)
                        return
                    }
                    if (err.code === npmi.INSTALL_ERR) {
                        console.log('npm install error: ' + err.message)
                        this.emit("log", "npm install: " + err.message, "main")
                        reject(err)
                        return
                    }
                    reject(err)
                    console.log(err.message);
                    this.emit("log", "npm install: " + err.message, "main")
                }
                resolve(result)

            }.bind(this))
        }

        return new Promise(install.bind(this))
    }
 
    public async dbLoadFileById(id: string): Promise<any> {
        var readstream = this.engine.gridfs.createReadStream({
            _id: id,
            root: this.name
        })

        try {
            return await Utils.fromStream(readstream)
        }
        catch (err) {
            throw Error(err.message)
        }
    }

    public async dbLoadFile(path: string): Promise<FileInfo> {
        try {
            var result = new FileInfo()

            //contentType
            var filedesc = await this.engine.db.collection(this.name + ".files").findOne({ filename: path })
            result.contentType = filedesc.contentType
            result.metadata = filedesc.metadata

            //buffer
            var readstream = this.engine.gridfs.createReadStream({
                filename: path,
                root: this.name
            })
            result.buffer = await Utils.fromStream(readstream)

            return result
        }
        catch (err) {
            throw Error(err.message)
        }
    }

    public async dbSaveFile(path: string, content: any, socket: any): Promise<void> {
        try {
            var filedesc = await this.engine.db.collection(this.name + ".files").findOne({ filename: path })
            var _id = (filedesc) ? filedesc._id : uuid.v1()

            var writestream = this.engine.gridfs.createWriteStream({
                _id: _id,
                filename: path,
                content_type: Utils.getMime(path),
                metadata: {
                    modified: moment().format('YYYY-MM-DD HH:mm:ss Z')
                },
                root: this.name
            })

            await Utils.toStream(content, writestream)
        }
        catch (err) {
            throw Error(err.message)
        }    
    }
}

class FileInfo {
    contentType: string
    metadata: any
    buffer: any
}
