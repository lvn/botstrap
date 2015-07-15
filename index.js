var fs = require('fs'),
  sequoria = require('sequoria'),
  createBot = require('./lib').createBot;

if (require.main === module) {
  // this module is being directly run.
  var configFile = process.argv[2] || 'config.json';
  if (!configFile.startsWith('/')) {
    // hack: should use proper path joining package
    configFile = [
      process.cwd(),
      configFile
    ].join('/');
  }

  var config = require(configFile);
  var bot = createBot(config);
  bot.start();
}

module.exports = createBot;
