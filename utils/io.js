const http = require('http');
const Koa = require('koa');
let io = require('socket.io');

module.exports = (routes) => {
  const app = new Koa();
  const server = http.createServer(app.callback());
  io = io(server);
  routes(io);
  return server;
};
