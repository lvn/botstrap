'use strict';

var sequoria = require('sequoria'),
  fs = require('fs');

var Bot = require('./bot');

var exports = module.exports = {};

var createBot = exports.createBot = function createBot(options) {

  // perform all the options checking here before creating a Bot.
  if (!options.token) {
    sequoria.error('No token found!')
    process.exit(1);
  }

  // load in any preconfigured bots
  if (options.bots && Array.isArray(options.bots)) {
    options.bots.forEach(function(bot) {
      // load bot

      // TODO: decide on config format
    });
  };

  var bot = new Bot(options);
  return bot;
};
