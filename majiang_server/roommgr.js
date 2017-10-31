const db = require('../utils/db');
const xlch = require('./gamemgr_xlch');
const xzdd = require('./gamemgr_xzdd');

const rooms = {};
const creatingRooms = {};

const userLocation = {};
let totalRooms = 0;

const DI_FEN = [1, 2, 5];
const MAX_FAN = [3, 4, 5];
const JU_SHU = [4, 8];
const JU_SHU_COST = [2, 3];


function generateRoomId() {
  let roomId = '';
  for (let i = 0; i < 6; i += 1) {
    roomId += Math.floor(Math.random() * 10);
  }
  return roomId;
}

function constructRoomFromDb(dbdata) {
  const roomInfo = {
    uuid: dbdata.uuid,
    id: dbdata.id,
    numOfGames: dbdata.num_of_turns,
    createTime: dbdata.create_time,
    nextButton: dbdata.next_button,
    seats: new Array(4),
    conf: JSON.parse(dbdata.base_info)
  };

  if (roomInfo.conf.type === 'xlch') {
    roomInfo.gameMgr = xlch;
  } else {
    roomInfo.gameMgr = xzdd;
  }
  const roomId = roomInfo.id;

  for (let i = 0; i < 4; i += 1) {
    roomInfo.seats[i] = {};
    const s = roomInfo.seats[i];
    s.userId = dbdata[`user_id${i}`];
    s.score = dbdata[`user_score${i}`];
    s.name = dbdata[`user_name${i}`];
    s.ready = false;
    s.seatIndex = i;
    s.numZiMo = 0;
    s.numJiePao = 0;
    s.numDianPao = 0;
    s.numAnGang = 0;
    s.numMingGang = 0;
    s.numChaJiao = 0;

    if (s.userId > 0) {
      userLocation[s.userId] = {
        roomId,
        seatIndex: i
      };
    }
  }
  rooms[roomId] = roomInfo;
  totalRooms += 1;
  return roomInfo;
}

exports.createRoom = async (creator, roomConf, gems, ip, port) => {
  if (
    roomConf.type == null ||
    roomConf.difen == null ||
    roomConf.zimo == null ||
    roomConf.jiangdui == null ||
    roomConf.huansanzhang == null ||
    roomConf.zuidafanshu == null ||
    roomConf.jushuxuanze == null ||
    roomConf.dianganghua == null ||
    roomConf.menqing == null ||
    roomConf.tiandihu == null
  ) {
    return null;
  }

  if (roomConf.difen < 0 || roomConf.difen > DI_FEN.length) {
    return null;
  }

  if (roomConf.zimo < 0 || roomConf.zimo > 2) {
    return null;
  }

  if (roomConf.zuidafanshu < 0 || roomConf.zuidafanshu > MAX_FAN.length) {
    return null;
  }

  if (roomConf.jushuxuanze < 0 || roomConf.jushuxuanze > JU_SHU.length) {
    return null;
  }

  const cost = JU_SHU_COST[roomConf.jushuxuanze];
  if (cost > gems) {
    return null;
  }

  const fnCreate = async () => {
    const roomId = generateRoomId();
    if (rooms[roomId] != null || creatingRooms[roomId] != null) {
      return fnCreate();
    }
    creatingRooms[roomId] = true;
    const isRoomExist = await db.is_room_exist(roomId);
    if (isRoomExist) {
      delete creatingRooms[roomId];
      return fnCreate();
    }
    const createTime = Math.ceil(Date.now() / 1000);
    const roomInfo = {
      uuid: '',
      id: roomId,
      numOfGames: 0,
      createTime,
      nextButton: 0,
      seats: [],
      conf: {
        type: roomConf.type,
        baseScore: DI_FEN[roomConf.difen],
        zimo: roomConf.zimo,
        jiangdui: roomConf.jiangdui,
        hsz: roomConf.huansanzhang,
        dianganghua: parseInt(roomConf.dianganghua, 10),
        menqing: roomConf.menqing,
        tiandihu: roomConf.tiandihu,
        maxFan: MAX_FAN[roomConf.zuidafanshu],
        maxGames: JU_SHU[roomConf.jushuxuanze],
        creator
      }
    };

    if (roomConf.type === 'xlch') {
      roomInfo.gameMgr = xlch;
    } else {
      roomInfo.gameMgr = xzdd;
    }

    for (let i = 0; i < 4; i += 1) {
      roomInfo.seats.push({
        userId: 0,
        score: 0,
        name: '',
        ready: false,
        seatIndex: i,
        numZiMo: 0,
        numJiePao: 0,
        numDianPao: 0,
        numAnGang: 0,
        numMingGang: 0,
        numChaJiao: 0
      });
    }

    // 写入数据库
    try {
      const uuid = await db.create_room(
        roomInfo.id,
        roomInfo.conf,
        ip,
        port,
        createTime
      );
      if (uuid !== null) {
        delete creatingRooms[roomId];
        roomInfo.uuid = uuid;
        rooms[roomId] = roomInfo;
        totalRooms += 1;
        return roomId;
      }
    } catch (e) {
      return null;
    }
  };
  return fnCreate();
};

exports.destroy = (roomId) => {
  const roomInfo = rooms[roomId];
  if (roomInfo == null) {
    return;
  }

  for (let i = 0; i < 4; i += 1) {
    const { userId } = roomInfo.seats[i];
    if (userId > 0) {
      delete userLocation[userId];
      db.set_room_id_of_user(userId, null);
    }
  }

  delete rooms[roomId];
  totalRooms -= 1;
  db.delete_room(roomId);
};

exports.getTotalRooms = () => totalRooms;

exports.getRoom = roomId => rooms[roomId];

exports.isCreator = (roomId, userId) => {
  const roomInfo = rooms[roomId];
  if (roomInfo == null) {
    return false;
  }
  return roomInfo.conf.creator === userId;
};

exports.enterRoom = async (roomId, userId, userName) => {
  const fnTakeSeat = (room) => {
    if (exports.getUserRoom(userId) === roomId) {
      // 已存在
      return 0;
    }

    for (let i = 0; i < 4; i += 1) {
      const seat = room.seats[i];
      if (seat.userId <= 0) {
        seat.userId = userId;
        seat.name = userName;
        userLocation[userId] = {
          roomId,
          seatIndex: i
        };
        // console.log(userLocation[userId]);
        db.update_seat_info(roomId, i, seat.userId, '', seat.name);
        // 正常
        return 0;
      }
    }
    // 房间已满
    return 1;
  };
  let room = rooms[roomId];
  if (room) {
    const ret = fnTakeSeat(room);
    return ret;
  }
  const dbdata = await db.get_room_data(roomId);
  if (dbdata == null) {
    return null;
  }
  room = constructRoomFromDb(dbdata);
  //
  const ret = fnTakeSeat(room);
  return ret;
};

exports.setReady = (userId, value) => {
  const roomId = exports.getUserRoom(userId);
  if (roomId == null) {
    return;
  }

  const room = exports.getRoom(roomId);
  if (room == null) {
    return;
  }

  const seatIndex = exports.getUserSeat(userId);
  if (seatIndex == null) {
    return;
  }

  const s = room.seats[seatIndex];
  s.ready = value;
};

exports.isReady = (userId) => {
  const roomId = exports.getUserRoom(userId);
  if (roomId == null) {
    return;
  }

  const room = exports.getRoom(roomId);
  if (room == null) {
    return;
  }

  const seatIndex = exports.getUserSeat(userId);
  if (seatIndex == null) {
    return;
  }

  const s = room.seats[seatIndex];
  return s.ready;
};

exports.getUserRoom = (userId) => {
  const location = userLocation[userId];
  if (location != null) {
    return location.roomId;
  }
  return null;
};

exports.getUserSeat = (userId) => {
  const location = userLocation[userId];
  // console.log(userLocation[userId]);
  if (location != null) {
    return location.seatIndex;
  }
  return null;
};

exports.getUserLocations = async () => userLocation;

exports.exitRoom = async (userId) => {
  const location = userLocation[userId];
  if (location == null) return;
  const { roomId, seatIndex } = location;
  const room = rooms[roomId];
  delete userLocation[userId];
  if (room == null || seatIndex == null) {
    return;
  }

  const seat = room.seats[seatIndex];
  seat.userId = 0;
  seat.name = '';

  let numOfPlayers = 0;
  for (let i = 0; i < room.seats.length; i += 1) {
    if (room.seats[i].userId > 0) {
      numOfPlayers += 1;
    }
  }

  await db.set_room_id_of_user(userId, null);

  if (numOfPlayers === 0) {
    exports.destroy(roomId);
  }
};
