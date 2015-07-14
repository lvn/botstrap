'use strict';

var sequoria = require('sequoria'),
  fs = require('fs');

var Bot = require('./bot');

var exports = module.exports = {};


var importers = {
  'command': function importCommandPlugin(bot, plugin) {
    bot.command(plugin.command, plugin.require);
  },
  'event': function importEventPlugin(bot, plugin) {
    bot.on(plugin.event, plugin.require);
  },
  'message': function importMessagePlugin(bot, plugin) {
    bot.onMessage(plugin.msgType, plugin.require);
  }
};

var createBot = exports.createBot = function createBot(options) {

  // perform all the options checking here before creating a Bot.
  if (!options.token) {
    sequoria.error('No token found!')
    process.exit(1);
  }

  var bot = new Bot(options);
  (options.bundles || []).forEach(bot.importBundle);
  (options.plugins || []).forEach(function(plugin) {
    var importer = importers[plugin.type];
    importer && importer(bot, plugin);
  });

  return bot;
};
