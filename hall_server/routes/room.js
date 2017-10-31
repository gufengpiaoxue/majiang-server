const crypto = require('../../utils/crypto');
const db = require('../../utils/db');
const request = require('request-promise');
const configs = require('../../configs');

const config = configs.hall_server();
const serverMap = {};

exports.start = (router) => {
  router.get('/register_gs', async (ctx) => {
    const req = ctx.request;
    const {
      query: {
        clientip, clientport, httpPort, load
      }
    } = req;
    let { ip } = req;
    if (ip.indexOf('::ffff:') !== -1) {
      ip = ip.substr(7);
    }
    const id = `${clientip}:${clientport}`;

    if (serverMap[id]) {
      const info = serverMap[id];
      if (
        info.clientport !== clientport ||
        info.httpPort !== httpPort ||
        info.ip !== ip
      ) {
        ctx.body = {
          errcode: 1,
          errmsg: `duplicate gsid:${id}`
        };
        return;
      }
      info.load = load;
      ctx.body = {
        errcode: 0,
        errmsg: 'ok',
        ip
      };
      return;
    }
    serverMap[id] = {
      ip,
      id,
      clientip,
      clientport,
      httpPort,
      load
    };
    ctx.body = {
      errcode: 0,
      errmsg: 'ok',
      ip
    };
  });
};

function chooseServer() {
  const list = Object.keys(serverMap).map(key => serverMap[key]);
  return list.reduce((a, b) => (a.load < b.load ? a : b));
}

exports.createRoom = async (account, userId, roomConf) => {
  const serverinfo = chooseServer();
  const { ip, httpPort } = serverinfo;
  const gems = await db.get_gems(account);
  const sign = crypto.md5(userId + roomConf + gems + config.ROOM_PRI_KEY);
  const roomInfo = await request({
    uri: `http://${ip}:${httpPort}/create_room`,
    qs: {
      userid: userId,
      gems,
      conf: roomConf,
      sign
    },
    json: true
  });
  return roomInfo.roomId;
};

exports.enterRoom = async (userId, name, roomId) => {
  const reqdata = {
    userid: userId,
    name,
    roomid: roomId
  };
  reqdata.sign = crypto.md5(userId + name + roomId + config.ROOM_PRI_KEY);

  const checkRoomIsRuning = async (serverinfo, sroomId) => {
    const { ip, httpPort } = serverinfo;
    const sign = crypto.md5(roomId + config.ROOM_PRI_KEY);
    const { errcode, runing } = await request({
      uri: `http://${ip}:${httpPort}/is_room_runing`,
      qs: {
        roomid: sroomId,
        sign
      },
      json: true
    });
    return errcode === 0 && runing;
  };

  const enterRoomReq = async (serverinfo) => {
    const {
      ip, httpPort, clientip, clientport
    } = serverinfo;
    const result = await request({
      uri: `http://${ip}:${httpPort}/enter_room`,
      qs: reqdata,
      json: true
    });
    const { token } = result;
    await db.set_room_id_of_user(userId, roomId);
    return { ip: clientip, port: clientport, token };
  };
  const [ip, port] = await db.get_room_addr(roomId);
  const id = `${ip}:${port}`;
  const serverinfo = serverMap[id];
  if (serverinfo !== null) {
    const isRuning = await checkRoomIsRuning(serverinfo, roomId);
    return enterRoomReq(isRuning ? serverinfo : chooseServer());
  }
  return enterRoomReq(chooseServer());
};

exports.isServerOnline = async (ip, port) => {
  const id = `${ip}:${port}`;
  const serverInfo = serverMap[id];
  if (!serverInfo) {
    return false;
  }
  const sign = crypto.md5(config.ROOM_PRI_KEY);
  return request({
    uri: `http://${serverInfo.ip}:${serverInfo.httpPort}/ping`,
    qs: {
      sign
    }
  });
};
