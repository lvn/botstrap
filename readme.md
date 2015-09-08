# Botstrap
### by [Elvin Yung](https://github.com/elvinyung)
## Slack-bot framework

**Botstrap** is a lightweight, extensible Slack bot framework built on top of the official Slack JavaScript client.

### Installation
With IO.js installed, install botstrap from NPM:

```
npm install -g botstrap
```

### Features
* Codeless bot construction
* Dynamic dependency-injected event API
* other stuff

### Getting Started
You can build a Botstrap bot by either writing a script that invokes the Botstrap APIs ([example](https://github.com/elvinyung/botstrap/blob/master/examples/quickstart/bot.js)), or simply by specifying behaviour through a config JSON ([example](https://github.com/elvinyung/botstrap/blob/master/examples/json/config.example.json)). You can run a bot script just as a normal io.js app, and you can run a config JSON as a bot using the command `botstrap [config filename]`.
