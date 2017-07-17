"use strict";

import Engine from './Engine'
import * as pathhelper from 'path'
import * as mongodb from "mongodb"
import * as moment from 'moment'
import * as uuid from "uuid"
import * as fsextra from 'fs-extra'
import Utils from './utils'

var cp = require('child_process')
var npmi = require('npmi')
var Git = require("nodegit")
var gitkit = require('nodegit-kit')

export default class Application {

    public engine: Engine
    public name: string
    public path: string
    public livePath: string
    public process: any
    public port: number
    
    constructor(application: string, engine: Engine) {
        this.name = application
        this.path = "/tmp/repos/" + this.name
        this.engine = engine
        this.livePath = this.engine.livePath + '/' + this.name
    }

    public run(){
        var pkg = fsextra.readFileSync(this.livePath + "/package.json")
        var pkgobj = JSON.parse(pkg.toString())

        process.execArgv = [] //DEBUG: ["--debug-brk=9229"] 
        //process.execArgv = ["--inspect=9229"] 
        var modulePath = pkgobj["main"] || "dist/server/start"
        var cwd = this.livePath

        var pos = modulePath.lastIndexOf('/')
        //if (pos != -1){
        //    cwd += '/' + modulePath.substr(0, pos)
        //    modulePath = modulePath.substr(pos+1)
        //} 
        this.port = this.engine.getFreePort()
        var args = []  //DEBUG: ["--debug-brk=9229"] 
        var options = { cwd: cwd, env: { workingUrl: this.engine.workingUrl, PORT: this.port } }
        this.process = cp.fork(modulePath, args, options)

        this.process.on('message', this.onMessage.bind(this))
    }

    public onMessage(message){
        console.log(message)
        switch (message.command){
            case "applications": this.applications(message.data); break
            case "update": this.onUpdate(message.data); break
            case "install": this.onInstall(message.data);  break
            case "uninstall": this.onUninstall(message.data);  break
        }
    }

    public async applications(data){
        var applications = Object.keys(this.engine.applications)
        this.process.send({ command: "applications", data: applications })
    }

    public async onUpdate(data){
        var app = this.engine.applications[data.app]
        app.updateFromGit()
    }

    public async onInstall(data){
        var app = await this.engine.install(data.name, data.url)
        await app.run()
    }

    public async onUninstall(data){
        await this.engine.uninstall(data.name)
    }

    public async installFromDb(){
        //if (fsextra.pathExistsSync(this.livePath)) return
        fsextra.ensureDirSync(this.livePath)
        var files = this.engine.db.collection("studio44.files").find()
        var filesArray = await files.toArray()
        await Promise.all(filesArray.map(async file => { await this.installFileFromDb(file.filename) }))
        await this.npminstall()
    }
   
    public async installFileFromDb(path: string): Promise<void> {
        var readstream = this.engine.gridfs.createReadStream({
            filename: path,
            root: this.name
        })
        var buffer = await Utils.fromStream(readstream)
        var fullPath = this.livePath + '/' + path
        fsextra.ensureDirSync(pathhelper.dirname(fullPath))
        fsextra.writeFileSync(fullPath, buffer, { flag: 'w' });
        console.log("writeFileSync: " + fullPath)
    }

    public async cloneFromGit(url: string): Promise<any> {
        try {
            console.log("clone...")
            //var url = await this.getRepositoryUrl()
            //var cloneOptions = { fetchOpts: { callbacks: this.engine.getRemoteCallbacks() } }
            var repo = await Git.Clone(url, this.livePath)
            console.log("clone success")
            return repo
        }
        catch(err){
            console.log(err)
            throw err
        }
    }

    public async updateFromGit(): Promise<any> {
        console.log(this.name + " update...")
        var repo = await Git.Repository.open(this.livePath) 
        await repo.fetchAll()
        var signature = this.getSignature()
        await repo.mergeBranches("master", "origin/master", signature, null, { fileFavor: Git.Merge.FILE_FAVOR.THEIRS })
        console.log(this.name + " update success")
        return repo
    }

    public getSignature(){
        return Git.Signature.create("Foo bar", "foo@bar.com", 123456789, 60);
    }

    public async getRepositorySsh(): Promise<string> {
        var registry = (await this.engine.db.collection(this.name).find().toArray())[0]
        return registry.repository.ssh
    }
 
    //public async getRepositoryUrl(): Promise<string> {
        //var registry = (await this.engine.db.collection(this.name).find().toArray())[0]
    //    var registry = { repository: { url: "https://gitlab.com/ultra2/" + this.name + ".git" } }
    //    return registry.repository.url.replace("https://", "https://oauth2:" + this.engine.gitLabAccessToken + "@")
    //}

    public async npminstall() {
        console.log(this.name + " npm install...")
        var options = {
	        //name: 'react-split-pane',	// your module name
            //version: '3.10.9',		// expected version [default: 'latest']
	        path: this.livePath,			// installation path [default: '.']
	        forceInstall: false,	        // force install if set to true (even if already installed, it will do a reinstall) [default: false]
            npmLoad: {				    // npm.load(options, callback): this is the "options" given to npm.load()
                loglevel: 'warn'	    // [default: {loglevel: 'silent'}]
            }
        }
 
        function donpminstall (resolve, reject) {
            npmi(options, function (err, result) {
                if (err) {
                    if (err.code === npmi.LOAD_ERR) {
                        console.log('npm load error')
                        reject(err)
                        return
                    }
                    if (err.code === npmi.INSTALL_ERR) {
                        console.log('npm install error: ' + err.message)
                        reject(err)
                        return
                    }
                    console.log('npm install error: ' + err.message);
                    reject(err)
                }
                console.log(this.name + " npm install success");
                resolve(result)

            }.bind(this))
        }

        return new Promise(donpminstall.bind(this))
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
