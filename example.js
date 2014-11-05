var Ttsync = require('./main.js');
var fs = require('fs');
var options = {};

if (fs.existsSync('./config.js')) {
    options = require('./config');
}

var ttsync = new Ttsync(options);
ttsync.init();