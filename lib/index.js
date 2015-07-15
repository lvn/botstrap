'use strict';

var sequoria = require('sequoria'),
  lfmt = require('lfmt'),
  fs = require('fs');

var Bot = require('./bot'),
  errMsgs = require('./constants').errMsgs;

var exports = module.exports = {};


var importers = {
  'command': function importCommandPlugin(bot, plugin) {
    bot.command(plugin.command, require(plugin.require));
  },
  'event': function importEventPlugin(bot, plugin) {
    bot.on(plugin.event, require(plugin.require));
  },
  'message': function importMessagePlugin(bot, plugin) {
    bot.onMessage(plugin.msgType, require(plugin.require));
  },
  'type_error': function nonexistentPluginType(bot, plugin) {
    sequoria.error(lfmt.format(errMsgs['err_plugin_type'], plugin));
  }
};

var createBot = exports.createBot = function createBot(options) {

  // perform all the options checking here before creating a Bot.
  if (!options.token) {
    sequoria.error(errMsgs['err_token'])
    process.exit(1);
  }

  var bot = new Bot(options);
  (options.bundles || []).forEach(bot.importBundle);
  (options.plugins || []).forEach(function(plugin) {
    var importer = importers[plugin.type] || importers.type_error;
    importer && importer(bot, plugin);
  });

  return bot;
};
