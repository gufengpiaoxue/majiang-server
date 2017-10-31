const crypto = require('../../utils/crypto');
const configs = require('../../configs');

const config = configs.game_server();

const tokenMgr = require('../tokenmgr');
const roomMgr = require('../roommgr');
const userMgr = require('../usermgr');

module.exports = (io) => {
  io.on('connection', (socket) => {
    socket.on('login', (da) => {
      const data = JSON.parse(da);
      if (socket.userId != null) {
        // 已经登陆过的就忽略
        return;
      }
      let { roomid: roomId } = data;
      const {
        token, time, sign
      } = data;

      // 检查参数合法性
      if (token == null || roomId == null || sign == null || time == null) {
        socket.emit('login_result', {
          errcode: 1,
          errmsg: 'invalid parameters'
        });
        return;
      }

      // 检查参数是否被篡改
      const md5 = crypto.md5(roomId + token + time + config.ROOM_PRI_KEY);
      if (md5 !== sign) {
        socket.emit('login_result', {
          errcode: 2,
          errmsg: 'login failed. invalid sign!'
        });
        return;
      }

      // 检查token是否有效
      if (tokenMgr.isTokenValid(token) === false) {
        socket.emit('login_result', {
          errcode: 3,
          errmsg: 'token out of time.'
        });
        return;
      }

      // 检查房间合法性
      const userId = tokenMgr.getUserID(token);
      roomId = roomMgr.getUserRoom(userId);

      userMgr.bind(userId, socket);
      socket.userId = userId;

      // 返回房间信息
      const roomInfo = roomMgr.getRoom(roomId);

      const seatIndex = roomMgr.getUserSeat(userId);
      roomInfo.seats[seatIndex].ip = socket.handshake.address;

      let userData = null;
      const seats = [];
      for (let i = 0; i < roomInfo.seats.length; i += 1) {
        const rs = roomInfo.seats[i];
        let online = false;
        if (rs.userId > 0) {
          online = userMgr.isOnline(rs.userId);
        }

        seats.push({
          userid: rs.userId,
          ip: rs.ip,
          score: rs.score,
          name: rs.name,
          online,
          ready: rs.ready,
          seatindex: i
        });

        if (userId === rs.userId) {
          userData = seats[i];
        }
      }

      // 通知前端
      const ret = {
        errcode: 0,
        errmsg: 'ok',
        data: {
          roomid: roomInfo.id,
          conf: roomInfo.conf,
          numofgames: roomInfo.numOfGames,
          seats
        }
      };
      socket.emit('login_result', ret);

      // 通知其它客户端
      userMgr.broacastInRoom('new_user_comes_push', userData, userId);

      socket.gameMgr = roomInfo.gameMgr;

      // 玩家上线，强制设置为TRUE
      socket.gameMgr.setReady(userId);

      socket.emit('login_finished');

      if (roomInfo.dr != null) {
        const { dr } = roomInfo;
        const ramaingTime = (dr.endTime - Date.now()) / 1000;
        const datas = {
          time: ramaingTime,
          states: dr.states
        };
        userMgr.sendMsg(userId, 'dissolve_notice_push', datas);
      }
    });

    socket.on('ready', () => {
      const { userId } = socket;
      if (userId == null) {
        return;
      }
      socket.gameMgr.setReady(userId);
      userMgr.broacastInRoom(
        'user_ready_push',
        { userid: userId, ready: true },
        userId,
        true
      );
    });

    // 换牌
    socket.on('huanpai', (dat) => {
      let data = dat;
      if (socket.userId == null) {
        return;
      }
      if (data == null) {
        return;
      }

      if (typeof data === 'string') {
        data = JSON.parse(data);
      }
      const { p1, p2, p3 } = data;
      if (p1 == null || p2 == null || p3 == null) {
        return;
      }
      socket.gameMgr.huanSanZhang(socket.userId, p1, p2, p3);
    });

    // 定缺
    socket.on('dingque', (data) => {
      if (socket.userId == null) {
        return;
      }
      const que = data;
      socket.gameMgr.dingQue(socket.userId, que);
    });

    // 出牌
    socket.on('chupai', (data) => {
      if (socket.userId == null) {
        return;
      }
      const pai = data;
      socket.gameMgr.chuPai(socket.userId, pai);
    });

    // 碰
    socket.on('peng', () => {
      if (socket.userId == null) {
        return;
      }
      socket.gameMgr.peng(socket.userId);
    });

    // 杠
    socket.on('gang', (data) => {
      if (socket.userId == null || data == null) {
        return;
      }
      let pai = -1;
      if (typeof data === 'number') {
        pai = data;
      } else if (typeof data === 'string') {
        pai = parseInt(data, 10);
      } else {
        console.log('gang:invalid param');
        return;
      }
      socket.gameMgr.gang(socket.userId, pai);
    });

    // 胡
    socket.on('hu', () => {
      if (socket.userId == null) {
        return;
      }
      socket.gameMgr.hu(socket.userId);
    });

    // 过  遇上胡，碰，杠的时候，可以选择过
    socket.on('guo', () => {
      if (socket.userId == null) {
        return;
      }
      socket.gameMgr.guo(socket.userId);
    });

    // 聊天
    socket.on('chat', (data) => {
      if (socket.userId == null) {
        return;
      }
      const chatContent = data;
      userMgr.broacastInRoom(
        'chat_push',
        { sender: socket.userId, content: chatContent },
        socket.userId,
        true
      );
    });

    // 快速聊天
    socket.on('quick_chat', (data) => {
      if (socket.userId == null) {
        return;
      }
      const chatId = data;
      userMgr.broacastInRoom(
        'quick_chat_push',
        { sender: socket.userId, content: chatId },
        socket.userId,
        true
      );
    });

    // 语音聊天
    socket.on('voice_msg', (data) => {
      if (socket.userId == null) {
        return;
      }
      userMgr.broacastInRoom(
        'voice_msg_push',
        { sender: socket.userId, content: data },
        socket.userId,
        true
      );
    });

    // 表情
    socket.on('emoji', (data) => {
      if (socket.userId == null) {
        return;
      }
      const phizId = data;
      userMgr.broacastInRoom(
        'emoji_push',
        { sender: socket.userId, content: phizId },
        socket.userId,
        true
      );
    });

    // 语音使用SDK不出现在这里

    // 退出房间
    socket.on('exit', () => {
      const { userId } = socket;
      if (userId == null) {
        return;
      }

      const roomId = roomMgr.getUserRoom(userId);
      if (roomId == null) {
        return;
      }

      // 如果游戏已经开始，则不可以
      if (socket.gameMgr.hasBegan(roomId)) {
        return;
      }

      // 如果是房主，则只能走解散房间
      if (roomMgr.isCreator(userId)) {
        return;
      }

      // 通知其它玩家，有人退出了房间
      userMgr.broacastInRoom('exit_notify_push', userId, userId, false);

      roomMgr.exitRoom(userId);
      userMgr.del(userId);

      socket.emit('exit_result');
      socket.disconnect();
    });

    // 解散房间
    socket.on('dispress', () => {
      const { userId } = socket;
      if (userId == null) {
        return;
      }

      const roomId = roomMgr.getUserRoom(userId);
      if (roomId == null) {
        return;
      }

      // 如果游戏已经开始，则不可以
      if (socket.gameMgr.hasBegan(roomId)) {
        return;
      }

      // 如果不是房主，则不能解散房间
      if (roomMgr.isCreator(roomId, userId) === false) {
        return;
      }

      userMgr.broacastInRoom('dispress_push', {}, userId, true);
      userMgr.kickAllInRoom(roomId);
      roomMgr.destroy(roomId);
      socket.disconnect();
    });

    // 解散房间
    socket.on('dissolve_request', () => {
      const { userId } = socket;
      if (userId == null) {
        return;
      }

      const roomId = roomMgr.getUserRoom(userId);
      if (roomId == null) {
        return;
      }

      // 如果游戏未开始，则不可以
      if (socket.gameMgr.hasBegan(roomId) == false) {
        return;
      }

      const ret = socket.gameMgr.dissolveRequest(roomId, userId);
      if (ret != null) {
        const { dr } = ret;
        const ramaingTime = (dr.endTime - Date.now()) / 1000;
        const data = {
          time: ramaingTime,
          states: dr.states
        };
        userMgr.broacastInRoom('dissolve_notice_push', data, userId, true);
      }
    });

    socket.on('dissolve_agree', () => {
      const { userId } = socket;

      if (userId == null) {
        return;
      }

      const roomId = roomMgr.getUserRoom(userId);
      if (roomId == null) {
        return;
      }

      const ret = socket.gameMgr.dissolveAgree(roomId, userId, true);
      if (ret != null) {
        const { dr } = ret;
        const ramaingTime = (dr.endTime - Date.now()) / 1000;
        const data = {
          time: ramaingTime,
          states: dr.states
        };
        userMgr.broacastInRoom('dissolve_notice_push', data, userId, true);

        let doAllAgree = true;
        for (let i = 0; i < dr.states.length; i += 1) {
          if (dr.states[i] === false) {
            doAllAgree = false;
            break;
          }
        }

        if (doAllAgree) {
          socket.gameMgr.doDissolve(roomId);
        }
      }
    });

    socket.on('dissolve_reject', () => {
      const { userId } = socket;

      if (userId == null) {
        return;
      }

      const roomId = roomMgr.getUserRoom(userId);
      if (roomId == null) {
        return;
      }

      const ret = socket.gameMgr.dissolveAgree(roomId, userId, false);
      if (ret != null) {
        userMgr.broacastInRoom('dissolve_cancel_push', {}, userId, true);
      }
    });

    // 断开链接
    socket.on('disconnect', () => {
      const { userId } = socket;
      if (!userId) {
        return;
      }
      const data = {
        userid: userId,
        online: false
      };

      // 通知房间内其它玩家
      userMgr.broacastInRoom('user_state_push', data, userId);

      // 清除玩家的在线信息
      userMgr.del(userId);
      socket.userId = null;
    });

    socket.on('game_ping', () => {
      const { userId } = socket;
      if (!userId) {
        return;
      }
      // console.log('game_ping');
      socket.emit('game_pong');
    });
  });
};
