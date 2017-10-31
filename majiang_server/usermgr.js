const roomMgr = require('./roommgr');

const userList = {};
let userOnline = 0;
exports.bind = (userId, socket) => {
  userList[userId] = socket;
  userOnline += 1;
};

exports.del = (userId) => {
  delete userList[userId];
  userOnline -= 1;
};

exports.get = userId => userList[userId];

exports.isOnline = (userId) => {
  const data = userList[userId];
  if (data != null) {
    return true;
  }
  return false;
};

exports.getOnlineCount = () => userOnline;

exports.sendMsg = (userId, event, msgdata) => {
  const userInfo = userList[userId];
  if (userInfo == null) {
    return;
  }
  const socket = userInfo;
  if (socket == null) {
    return;
  }

  socket.emit(event, msgdata);
};

exports.kickAllInRoom = (roomId) => {
  if (roomId == null) {
    return;
  }
  const roomInfo = roomMgr.getRoom(roomId);
  if (roomInfo == null) {
    return;
  }

  for (let i = 0; i < roomInfo.seats.length; i += 1) {
    const rs = roomInfo.seats[i];

    // 如果不需要发给发送方，则跳过
    if (rs.userId > 0) {
      const socket = userList[rs.userId];
      if (socket != null) {
        exports.del(rs.userId);
        socket.disconnect();
      }
    }
  }
};

exports.broacastInRoom = (event, data, sender, includingSender) => {
  const roomId = roomMgr.getUserRoom(sender);
  if (roomId == null) {
    return;
  }
  const roomInfo = roomMgr.getRoom(roomId);
  if (roomInfo == null) {
    return;
  }

  for (let i = 0; i < roomInfo.seats.length; i += 1) {
    const rs = roomInfo.seats[i];

    // 如果不需要发给发送方，则跳过
    if (rs.userId === sender && includingSender !== true) {
      continue;
    }
    const socket = userList[rs.userId];
    if (socket != null) {
      socket.emit(event, data);
    }
  }
};
