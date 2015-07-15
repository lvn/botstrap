#!/usr/bin/env iojs

var fs = require('fs'),
  sequoria = require('sequoria'),
  createBot = require('./lib').createBot;

function main() {
  // this module is being directly run.
  var configFile = process.argv[2] || 'config.json';
  if (!configFile.startsWith('/')) {
    // hack: should use proper path joining package
    configFile = [
      process.cwd(),
      configFile
    ].join('/');
  }

  var config = JSON.parse(fs.readFileSync(configFile));
  var bot = createBot(config);
  bot.start();
}

if (require.main === module) {
  main();
}

module.exports = createBot;
