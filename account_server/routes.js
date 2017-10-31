const request = require('request-promise');

const db = require('../utils/db');
const crypto = require('../utils/crypto');
const configs = require('../configs');

const config = configs.account_server();

module.exports = (router) => {
  const hallAddr = `${config.HALL_IP}:${config.HALL_CLIENT_PORT}`;
  router
    .get('/register', async (ctx) => {
      const req = ctx.request;
      const { query: { account, password } } = req;
      const exist = await db.is_user_exist(account);
      if (!exist) {
        await db.create_account(account, password);
        ctx.body = { errcode: 0, errmsg: 'ok' };
      } else {
        ctx.body = { errcode: 1, errmsg: 'account has been used.' };
      }
    })
    .get('/get_version', async (ctx) => {
      ctx.body = { version: config.VERSION };
    })
    .get('/get_serverinfo', async (ctx) => {
      ctx.body = {
        version: config.VERSION,
        hall: hallAddr,
        appweb: config.APP_WEB
      };
    })
    .get('/guest', async (ctx) => {
      const req = ctx.request;
      const account = `guest_${req.query.account}`;
      const sign = crypto.md5(account + req.ip + config.ACCOUNT_PRI_KEY);
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        account,
        halladdr: hallAddr,
        sign
      };
    })
    .get('/auth', async (ctx) => {
      const req = ctx.request;
      let { query: { account, password } } = req;
      const info = await db.get_account_info(account, password);
      if (info === null) {
        ctx.body = { errcode: 1, errmsg: 'invalid account' };
      }
      account = `vivi_${account}`;
      const sign = crypto.md5(`${account}${req.ip}${config.ACCOUNT_PRI_KEY}`);
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        account,
        sign
      };
    })
    .get('/wechat_auth', async (ctx) => {
      const req = ctx.request;
      const { query: { code, os } } = req;
      const { access_token, openid } = await get_access_token(code, os);
      const { nickname, sex, headimgurl } = await get_state_info(
        access_token,
        openid
      );
      const account = `wx_${openid}`;
      await create_user(account, nickname, sex, headimgurl);
      const sign = crypto.md5(account + req.ip + config.ACCOUNT_PRI_KEY);
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        account,
        halladdr: hallAddr,
        sign
      };
    })
    .get('/base_info', async (ctx) => {
      const req = ctx.request;
      const { query: { userid } } = req;
      const { name, sex, headimg: headimgurl } = await db.get_user_base_info(userid);
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        name,
        sex,
        headimgurl
      };
    });
  return router;
};

const appInfo = {
  Android: {
    appid: 'wxe39f08522d35c80c',
    secret: 'fa88e3a3ca5a11b06499902cea4b9c01'
  },
  iOS: {
    appid: 'wxcb508816c5c4e2a4',
    secret: '7de38489ede63089269e3410d5905038'
  }
};

function get_access_token(code, os) {
  const info = appInfo[os];
  const options = {
    uri: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    qs: {
      appid: info.appid,
      secret: info.secret,
      code,
      grant_type: 'authorization_code'
    },
    json: true
  };
  return request(options);
}

function get_state_info(access_token, openid) {
  const options = {
    uri: 'https://api.weixin.qq.com/sns/userinfo',
    qs: {
      access_token,
      openid
    }
  };
  return request(options);
}

async function create_user(account, name, sex, headimgurl) {
  const coins = 1000;
  const gems = 21;
  const exist = await db.is_user_exist(account);
  if (!exist) {
    await db.create_user(account, name, coins, gems, sex, headimgurl);
  } else {
    await db.update_user_info(account, name, headimgurl, sex);
  }
  return true;
}
