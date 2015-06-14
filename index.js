
var fs = require('fs'),
  sequoria = require('sequoria'),
  createBot = require('./lib');

if (require.main === module) {
  // this module is being directly run.
  var configFilename = process.argv[1] || 'config.json',
    config = JSON.parse(fs.readFileSync(configFilename));
  var bot = createBot(config);
  bot.start();
}

module.exports = createBot;
