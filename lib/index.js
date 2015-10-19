'use strict';

var sequoria = require('sequoria'),
  lfmt = require('lfmt'),
  fs = require('fs'),
  relative = require('require-relative');

var Bot = require('./bot'),
  errMsgs = require('./constants').errMsgs;

var exports = module.exports = {};


var importers = {
  'command': function importCommandPlugin(bot, plugin, config) {
    bot.command(plugin.command, relative(plugin.require), config);
  },
  'event': function importEventPlugin(bot, plugin, config) {
    bot.on(plugin.event, relative(plugin.require), config);
  },
  'message': function importMessagePlugin(bot, plugin, config) {
    bot.onMessage(plugin.msgType, relative(plugin.require), config);
  },
  'match': function importMatchPlugin(bot, plugin, config) {
    var regex = plugin.regex;
    bot.match(new RegExp(regex.pattern, regex.flags),
      relative(plugin.require),
      config);
  },
  'catch': function importCatchPlugin(bot, plugin, config) {
    bot.catch(relative(plugin.require), config);
  },
  'type_error': function nonexistentPluginType(bot, plugin, config) {
    sequoria.error(lfmt.format(errMsgs['err_plugin_type'], plugin));
  }
};

var createBot = exports.createBot = function createBot(options) {

  // perform all the options checking here before creating a Bot.
  if (!options.token) {
    sequoria.error(errMsgs['err_token']);
    process.exit(1);
  }

  var bot = new Bot(options);
  (options.bundles || []).forEach(function(bundle) {
    (typeof bundle === 'string') ?
      bot.importBundle(bundle, {}) :
      bot.importBundle(bundle.require, bundle.config);
  });

  (options.services || []).forEach(function(service) {
    var name, initFn;
    if (typeof service === 'string') {
      name = service;
      initFn = relative(service);
    }
    else if (typeof service === 'object') {
      name = service.name;
      initFn = relative(service.require);
    }

    bot.service(name, initFn);
  });

  (options.plugins || []).forEach(function(plugin) {
    var importer = importers[plugin.type] || importers.type_error;
    importer(bot, plugin, plugin.config);
  });

  return bot;
};
