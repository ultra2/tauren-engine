'use strict';

var fs = require('fs')

function Binding(virtualfs) {
	this.virtualfs = virtualfs
}

Binding.prototype.readFileSync = function(path, options) {
	if (path.substring(0,9) == "/virtual/"){
		return this.virtualfs.readFileSync(path)
	}
	else{
		return fs.realFunctions.readFileSync(path, options)
	}
}

exports = module.exports = Binding;