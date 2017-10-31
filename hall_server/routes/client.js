const crypto = require('../../utils/crypto');
const db = require('../../utils/db');
const room_service = require('./room');

const configs = require('../../configs');

const config = configs.hall_server();

module.exports = (router) => {
  router
    .get('/login', async (ctx) => {
      const req = ctx.request;
      let { ip } = req;
      const { query: { account } } = req;
      if (ip.indexOf('::ffff:') !== -1) {
        ip = ip.substr(7);
      }

      const userData = await db.get_user_data(account);
      if (userData === null) {
        ctx.body = {
          errcode: 0,
          errmsg: 'ok'
        };
        return;
      }
      const {
        userid, name, lv, exp, coins, gems, sex
      } = userData;
      const result = {
        account,
        userid,
        name,
        lv,
        exp,
        coins,
        gems,
        ip,
        sex
      };
      const roomId = await db.get_room_id_of_user(userid);
      const isRoomExist = await db.is_room_exist(roomId);
      if (isRoomExist) {
        result.roomid = roomId;
      } else {
        await db.set_room_id_of_user(userid, null);
      }
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        ...result
      };
    })
    .get('/create_user', async (ctx) => {
      const req = ctx.request;
      const { query: { account, name } } = req;
      const coins = 1000;
      const gems = 21;
      const isUserExist = await db.is_user_exist(account);
      if (!isUserExist) {
        const userInfo = await db.create_user(
          account,
          name,
          coins,
          gems,
          0,
          null
        );
        if (userInfo) {
          ctx.body = {
            errcode: 0,
            errmsg: 'ok'
          };
        } else {
          ctx.body = {
            errcode: 2,
            errmsg: 'system error'
          };
        }
      } else {
        ctx.body = {
          errcode: 1,
          errmsg: 'account have already exist.'
        };
      }
    })
    .get('/create_private_room', async (ctx) => {
      // 验证参数合法性
      const req = ctx.request;
      const { query: { account, conf } } = req;
      const userInfo = await db.get_user_data(account);
      if (userInfo === null) {
        ctx.body = { errcode: 1, errmsg: 'system error' };
        return;
      }
      const { userid: userId, name } = userInfo;
      const roomId = await db.get_room_id_of_user(userId);
      if (roomId !== null) {
        ctx.body = { errcode: -1, errmsg: 'user is playing in room now.' };
        return;
      }
      const newRoomId = await room_service.createRoom(account, userId, conf);
      const enterInfo = await room_service.enterRoom(userId, name, newRoomId);
      if (enterInfo) {
        const ret = {
          roomid: newRoomId,
          ip: enterInfo.ip,
          port: enterInfo.port,
          token: enterInfo.token,
          time: Date.now()
        };
        ret.sign = crypto.md5(ret.roomid + ret.token + ret.time + config.ROOM_PRI_KEY);
        ctx.body = {
          errcode: 0,
          errmsg: 'ok',
          ...ret
        };
      } else {
        ctx.body = {
          errcode: 1,
          errmsg: "room doesn't exist."
        };
      }
    })
    .get('/enter_private_room', async (ctx) => {
      const req = ctx.request;
      const { query: { roomid: roomId, account } } = req;
      const userInfo = await db.get_user_data(account);
      const { userid: userId, name } = userInfo;
      const enterInfo = await room_service.enterRoom(userId, name, roomId);
      if (enterInfo) {
        const ret = {
          roomid: roomId,
          ip: enterInfo.ip,
          port: enterInfo.port,
          token: enterInfo.token,
          time: Date.now()
        };
        ret.sign = crypto.md5(roomId + ret.token + ret.time + config.ROOM_PRI_KEY);
        ctx.body = {
          errcode: 0,
          errmsg: 'ok',
          ...ret
        };
      } else {
        ctx.body = {
          errcode: 1,
          errmsg: 'enter room failed.'
        };
      }
    })
    .get('/get_history_list', async (ctx) => {
      const req = ctx.request;
      const { query: { account } } = req;
      const userInfo = await db.get_user_data(account);
      const { userid: userId } = userInfo;
      const history = await db.get_user_history(userId);
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        history
      };
    })
    .get('/get_games_of_room', async (ctx) => {
      const req = ctx.request;
      const { query: { uuid } } = req;
      const data = await db.get_games_of_room(uuid);
      this.body = {
        errcode: 0,
        errmsg: 'ok',
        data
      };
    })
    .get('/get_detail_of_game', async (ctx) => {
      const req = ctx.request;
      const { query: { uuid, index } } = req;
      const data = await db.get_detail_of_game(uuid, index);
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        data
      };
    })
    .get('/get_user_status', async (ctx) => {
      const req = ctx.request;
      const { query: { account } } = req;
      const gems = await db.get_gems(account);
      if (gems === null) {
        ctx.body = {
          errcode: 1,
          errmsg: 'get gems failed.'
        };
      } else {
        ctx.body = {
          errcode: 0,
          errmsg: 'ok',
          gems
        };
      }
    })
    .get('/get_message', async (ctx) => {
      const req = ctx.request;
      const { query: { type, version } } = req;
      const data = await db.get_message(type, version);
      if (data !== null) {
        ctx.body = {
          errcode: 0,
          errmsg: 'ok',
          msg: data.msg,
          version: data.version
        };
      } else {
        ctx.body = {
          errcode: 1,
          errmsg: 'get message failed.'
        };
      }
    })
    .get('/is_server_online', async (ctx) => {
      const req = ctx.request;
      const { query: { ip, port } } = req;
      let isonline = false;
      try {
        const result = await room_service.isServerOnline(ip, port);
        if (result.errcode === 0) {
          isonline = true;
        }
      } catch (e) {
        isonline = false;
      }
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        isonline
      };
    });
};