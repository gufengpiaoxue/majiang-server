const Koa = require('koa');

const Router = require('koa-router');
const bodyParser = require('koa-bodyparser');
const cors = require('koa-cors');
const logger = require('koa-logger');
const error = require('koa-error');
const convert = require('koa-convert');

module.exports = (routes) => {
  const app = new Koa();
  const router = new Router();
  routes(router);
  app
    .use(error())
    .use(convert(cors()))
    .use(logger())
    .use(bodyParser())
    .use(router.routes())
    .use(router.allowedMethods());
  return app;
};
