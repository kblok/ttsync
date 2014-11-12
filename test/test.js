var chai = require('chai');
var sinon = require('sinon');
var sinonChai = require("sinon-chai");
chai.should();
chai.use(sinonChai);

var restler = require('restler');
var Ttsync = require('../main');

describe('ttsync', function () {

    beforeEach(function () {

    });

    describe('connections', function () {

        it('Initialize', function () {
            var fs = require('fs'),
                options = {},
                ttsync;

            if (fs.existsSync('./config.js')) {
                options = require('../config');
            }

            ttsync = new Ttsync(options);
            ttsync.init();
        });

    });
});