
var sequoria = require('sequoria'),
  lfmt = require('lfmt'),
  fs = require('fs'),
  relative = require('require-relative');

var Bot = require('./bot'),
  errMsgs = require('./constants').errMsgs;


var importers = {
  'command': function importCommandPlugin(bot, plugin) {
    bot.command(plugin.command, relative(plugin.require), plugin.config);
  },
  'event': function importEventPlugin(bot, plugin) {
    bot.on(plugin.event, relative(plugin.require), plugin.config);
  },
  'message': function importMessagePlugin(bot, plugin) {
    bot.onMessage(plugin.msgType, relative(plugin.require), plugin.config);
  },
  'match': function importMatchPlugin(bot, plugin) {
    var regex = plugin.regex;
    bot.match(new RegExp(regex.pattern, regex.flags),
      relative(plugin.require),
      plugin.config);
  },
  'catch': function importCatchPlugin(bot, plugin) {
    bot.catch(relative(plugin.require), plugin.config);
  },
  'type_error': function nonexistentPluginType(bot, plugin) {
    sequoria.error(lfmt.format(errMsgs['err_plugin_type'], plugin));
  }
};

exports.createBot = function createBot(options) {

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
    var name, initFn, config;
    if (typeof service === 'string') {
      initFn = relative(service);
      name = (initFn.metadata && initFn.metadata.name) ||
        service;
      config = {};
    }
    else if (typeof service === 'object') {
      initFn = relative(service.require);
      name = (initFn.metadata && initFn.metadata.name) ||
        service.name;
      config = service.config || {};
    }

    bot.service(name, initFn, config);
  });

  (options.plugins || []).forEach(function(plugin) {
    var importer = importers[plugin.type] || importers.type_error;
    importer(bot, plugin);
  });

  return bot;
};
