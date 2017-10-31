const request = require('request-promise');

const crypto = require('../../utils/crypto');
const roomMgr = require('../roommgr');
const tokenMgr = require('../tokenmgr');
const configs = require('../../configs');

const config = configs.game_server();
const gameServerInfo = {
  id: config.SERVER_ID,
  clientip: config.CLIENT_IP,
  clientport: config.CLIENT_PORT,
  httpPort: config.HTTP_PORT,
  load: roomMgr.getTotalRooms()
};

let serverIp = '';

module.exports = (router) => {
  router
    .get('/get_server_info', async (ctx) => {
      const req = ctx.request;
      const { query: { serverid: serverId, sign } } = req;
      if (serverId !== config.SERVER_ID || sign == null) {
        this.body = { errcode: 1, errmsg: 'invalid parameters' };
        return;
      }
      const md5 = crypto.md5(serverId + config.ROOM_PRI_KEY);
      if (md5 !== sign) {
        this.body = { errcode: 1, errmsg: 'sign check failed.' };
        return;
      }
      const locations = roomMgr.getUserLocations();
      const arr = [];
      Object.keys(locations).forEach((userId) => {
        const { roomId } = locations[userId];
        arr.push(userId);
        arr.push(roomId);
      });
      ctx.body = { errcode: 0, errmsg: 'ok', userroominfo: arr };
    })
    .get('/create_room', async (ctx) => {
      const req = ctx.request;
      const {
        query: {
          sign, gems, conf, userid
        }
      } = req;
      const userId = parseInt(userid, 10);
      if (userId == null || sign == null || conf == null) {
        ctx.body = { errcode: 1, errmsg: 'invalid parameters' };
        return;
      }

      const md5 = crypto.md5(userId + conf + gems + config.ROOM_PRI_KEY);
      if (md5 !== sign) {
        ctx.body = { errcode: 1, errmsg: 'sign check failed.' };
        return;
      }
      try {
        const roomId = await roomMgr.createRoom(
          userId,
          JSON.parse(conf),
          gems,
          serverIp,
          config.CLIENT_PORT
        );
        ctx.body = {
          errcode: 0,
          errmsg: 'ok',
          roomId
        };
      } catch (e) {
        ctx.body = {
          errcode: 1,
          errmsg: 'create room faild.'
        };
      }
    })
    .get('/enter_room', async (ctx) => {
      const req = ctx.request;
      const {
        query: {
          userid, name, roomid: roomId, sign
        }
      } = req;
      const userId = parseInt(userid, 10);
      if (userId == null || roomId == null || sign == null) {
        ctx.body = { errcode: 1, errmsg: 'invalid parameters' };
        return;
      }

      const md5 = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);
      if (md5 !== sign) {
        ctx.body = { errcode: 1, errmsg: 'sign check failed.' };
        return;
      }

      // 安排玩家坐下
      try {
        const result = roomMgr.enterRoom(roomId, userId, name);
        if (result === 1) {
          ctx.body = { errcode: 4, errmsg: 'room is full.' };
          return;
        }
      } catch (e) {
        ctx.body = { errcode: 3, errmsg: "can't find room." };
        return;
      }
      const token = tokenMgr.createToken(userId, 5000);
      ctx.body = { errcode: 0, errmsg: 'ok', token };
    })
    .get('/ping', async (ctx) => {
      const req = ctx.request;
      const { query: { sign } } = req;
      const md5 = crypto.md5(config.ROOM_PRI_KEY);
      if (md5 !== sign) {
        return;
      }
      ctx.body = { errcode: 0, errmsg: 'pong' };
    })
    .get('/is_room_runing', async (ctx) => {
      const req = ctx.request;
      const { query: { roomid: roomId, sign } } = req;
      if (roomId == null || sign == null) {
        ctx.body = { errcode: 1, errmsg: 'invalid parameters' };
        return;
      }

      const md5 = crypto.md5(roomId + config.ROOM_PRI_KEY);
      if (md5 !== sign) {
        ctx.body = { errcode: 1, errmsg: 'sign check failed.' };
        return;
      }

      // const roomInfo = roomMgr.getRoom(roomId);
      ctx.body = { errcode: 0, errmsg: 'runing: true' };
    });
};

let lastTickTime = 0;

// 向大厅服定时心跳
async function update() {
  if (lastTickTime + config.HTTP_TICK_TIME < Date.now()) {
    lastTickTime = Date.now();
    gameServerInfo.load = roomMgr.getTotalRooms();
    try {
      const data = await request({
        uri: `http://${config.HALL_IP}:${config.HALL_PORT}/register_gs`,
        qs: gameServerInfo,
        json: true
      });
      if (data.ip != null) {
        serverIp = data.ip;
      }
    } catch (e) {
      lastTickTime = 0;
    }
    const mem = process.memoryUsage();
    const format = function (bytes) {
      return `${(bytes / 1024 / 1024).toFixed(2)}MB`;
    };
    console.log(`Process: heapTotal ${format(mem.heapTotal)} heapUsed ${format(mem.heapUsed)} rss ${format(mem.rss)}`);
  }
}

setInterval(update, 1000);
