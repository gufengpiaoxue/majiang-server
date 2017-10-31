const mysql = require('promise-mysql');
const crypto = require('./crypto');
const configs = require('../configs');

const config = configs.mysql();

const pool = mysql.createPool({
  host: config.HOST,
  user: config.USER,
  password: config.PSWD,
  database: config.DB,
  port: config.PORT
});

function query(...args) {
  return pool.query(...args);
}

exports.is_account_exist = async (account) => {
  const sql = 'SELECT * FROM t_accounts WHERE account = ?';
  return (await query(sql, [account])).length > 0;
};

exports.create_account = async (account, password) => {
  const sql = 'INSERT INTO t_accounts(account, password) VALUES(?, ?)';
  const rows = await query(sql, [account, crypto.md5(password)]);
  return rows.affectedRows > 0;
};

exports.get_account_info = async (account, password) => {
  const sql =
    'SELECT * FROM t_accounts WHERE account = ? AND password = ? LIMIT 1';
  const rows = await query(sql, [account, crypto.md5(password)]);
  return rows[0] || null;
};

exports.is_user_exist = async (account) => {
  const sql = 'SELECT userid FROM t_users WHERE account = ?';
  return (await query(sql, [account])).length > 0;
};

exports.get_user_data = async (account) => {
  const sql =
    'SELECT userid, account, name, lv, exp, coins, gems, roomid FROM t_users WHERE account = ?';
  const rows = await query(sql, [account]);
  if (rows.length > 0) {
    rows[0].name = crypto.fromBase64(rows[0].name);
  }
  return rows[0] || null;
};

exports.get_user_data_by_userid = async (userid) => {
  const sql =
    'SELECT userid, account, name, lv, exp, coins, gems, roomid FROM t_users WHERE userid = ?';
  const rows = await query(sql, [userid]);
  if (rows.length > 0) {
    rows[0].name = crypto.fromBase64(rows[0].name);
  }
  return rows[0] || null;
};

/** 增加玩家房卡 */
exports.add_user_gems = async (userid, gems) => {
  const sql = 'UPDATE t_users SET gems = gems + ? WHERE userid = ?';
  const rows = await query(sql, [gems, userid]);
  return rows.affectedRows > 0;
};

exports.get_gems = async (account) => {
  const sql = 'SELECT gems FROM t_users WHERE account = ?';
  const [{ gems }] = await query(sql, [account]);
  return gems;
};

exports.get_user_history = async (userId) => {
  const sql = 'SELECT history FROM t_users WHERE userid = ?';
  const rows = await query(sql, [userId]);
  return rows[0] && rows[0].history && JSON.parse(rows[0].history);
};

exports.update_user_history = async (userId, history) => {
  const sql = 'UPDATE t_users SET roomid = null, history = ? WHERE userid = ?';
  const rows = await query(sql, [JSON.stringify(history), userId]);
  return rows.affectedRows > 0;
};

exports.get_games_of_room = async (roomUuid) => {
  const sql =
    'SELECT game_index, create_time, result FROM t_games_archive WHERE room_uuid = ?';
  const rows = await query(sql, [roomUuid]);
  return rows[0] || null;
};

exports.get_detail_of_game = async (roomUuid, index) => {
  const sql =
    'SELECT base_info,action_records FROM t_games_archive WHERE room_uuid = ? AND game_index = ?';
  const rows = query(sql, [roomUuid, index]);
  return rows[0] || null;
};

exports.create_user = async (account, name, coins, gems, sex, headimg) => {
  const sql =
    'INSERT INTO t_users(account, name, coins, gems, sex, headimg) VALUES(?, ?, ?, ?, ?, ?)';
  const rows = await query(sql, [
    account,
    crypto.toBase64(name),
    coins,
    gems,
    sex,
    headimg
  ]);
  return rows.affectedRows > 0;
};

exports.update_user_info = async (account, name, headimg, sex) => {
  const sql =
    'UPDATE t_users SET name = ?, headimg = ?, sex = ? WHERE account = ?}';
  const rows = await query(sql, [crypto.toBase64(name), headimg, sex, account]);
  return rows.affectedRows > 0;
};

exports.get_user_base_info = async (userid) => {
  const sql = 'SELECT name,sex, headimg FROM t_users WHERE userid = ?';
  const rows = await query(sql, [userid]);
  if (rows.length > 0) {
    rows[0].name = crypto.fromBase64(rows[0].name);
  }
  return rows[0] || null;
};

exports.is_room_exist = async (roomId) => {
  const sql = 'SELECT * FROM t_rooms WHERE id = ?';
  const rows = await query(sql, [roomId]);
  return rows.length > 0;
};

exports.cost_gems = async (userid, cost) => {
  const sql = 'UPDATE t_users SET gems = gems - ? WHERE userid = ?';
  const rows = await query(sql, [cost, userid]);
  return rows.affectedRows > 0;
};

exports.set_room_id_of_user = async (userId, roomId) => {
  const sql = 'UPDATE t_users SET roomid = ? WHERE userid = ?';
  const rows = await query(sql, [roomId, userId]);
  return rows.affectedRows > 0;
};

exports.get_room_id_of_user = async (userId) => {
  const sql = 'SELECT roomid FROM t_users WHERE userid = ?';
  const rows = await query(sql, [userId]);
  return (rows[0] && rows[0].roomid) || null;
};

exports.create_room = async (roomId, conf, ip, port, createTime) => {
  const uuid = Date.now() + roomId;
  const baseInfo = JSON.stringify(conf);
  const sql =
    'INSERT INTO t_rooms(uuid, id, base_info, ip, port, create_time) VALUES(?, ?, ?, ?, ?, ?)';
  await query(sql, [uuid, roomId, baseInfo, ip, port, createTime]);
  return uuid;
};

exports.get_room_uuid = async (roomId) => {
  const sql = 'SELECT uuid FROM t_rooms WHERE id = ?';
  const rows = await query(sql, [roomId]);
  return (rows[0] && rows[0].uuid) || null;
};

exports.update_seat_info = async (roomId, seatIndex, userId, icon, name) => {
  const sql =
    'UPDATE t_rooms SET user_id? = ?, user_icon? = ?, user_name? = ? WHERE id = ?';
  const rows = await query(sql, [
    seatIndex,
    userId,
    seatIndex,
    icon,
    seatIndex,
    crypto.toBase64(name),
    roomId
  ]);
  return rows.affectedRows > 0;
};

exports.update_num_of_turns = async (roomId, numOfTurns) => {
  const sql = 'UPDATE t_rooms SET num_of_turns = ? WHERE id = ?';
  const rows = await query(sql, [numOfTurns, roomId]);
  return rows.affectedRows > 0;
};

exports.update_next_button = async (roomId, nextButton) => {
  const sql = 'UPDATE t_rooms SET next_button = ? WHERE id = ?';
  const rows = await query(sql, [nextButton, roomId]);
  return rows.affectedRows > 0;
};

exports.get_room_addr = async (roomId) => {
  const sql = 'SELECT ip, port FROM t_rooms WHERE id = ?';
  const rows = await query(sql, [roomId]);
  const { ip, port } = rows[0];
  return [ip, port];
};

exports.get_room_data = async (roomId) => {
  const sql = 'SELECT * FROM t_rooms WHERE id = ?';
  const rows = await query(sql, [roomId]);
  if (rows.length > 0) {
    rows[0].user_name0 = crypto.fromBase64(rows[0].user_name0);
    rows[0].user_name1 = crypto.fromBase64(rows[0].user_name1);
    rows[0].user_name2 = crypto.fromBase64(rows[0].user_name2);
    rows[0].user_name3 = crypto.fromBase64(rows[0].user_name3);
  }
  return rows[0] || null;
};

exports.delete_room = async (roomId) => {
  const sql = 'DELETE FROM t_rooms WHERE id = ?';
  const rows = await query(sql, [roomId]);
  return rows.affectedRows > 0;
};

exports.create_game = async (roomUuid, index, baseInfo) => {
  const sql = 'INSERT INTO t_games(room_uuid, game_index, base_info, create_time) VALUES(?, ?, ?, unix_timestamp(now()))';
  const rows = await query(sql, [roomUuid, index, baseInfo]);
  return rows.insertId;
};

exports.delete_games = async (roomUuid) => {
  const sql = 'DELETE FROM t_games WHERE room_uuid = ?';
  const rows = await query(sql, [roomUuid]);
  return rows.affectedRows;
};

exports.archive_games = async (roomUuid) => {
  const sql = 'INSERT INTO t_games_archive(SELECT * FROM t_games WHERE room_uuid = ?)';
  return (
    (await query(sql, [roomUuid])).affectedRows > 0 &&
    (await exports.delete_games(roomUuid)).affectedRows > 0
  );
};

exports.update_game_action_records = async (roomUuid, index, actions) => {
  const sql = 'UPDATE t_games SET action_records = ? WHERE room_uuid = ? AND game_index = ?';
  const rows = await query(sql, [actions, roomUuid, index]);
  return rows.affectedRows > 0;
};

exports.update_game_result = async (roomUuid, index, result) => {
  const sql = 'UPDATE t_games SET result = ? WHERE room_uuid = ? AND game_index = ?';
  const rows = await query(sql, [JSON.stringify(result), roomUuid, index]);
  return rows.affectedRows > 0;
};

exports.get_message = async (type, ver) => {
  let sql = 'SELECT * FROM t_message WHERE type = ?';
  let version = ver;
  if (version === 'null') {
    version = null;
  }

  if (version) {
    sql = `${sql} AND version != ?`;
  }
  const rows = await query(sql, [type, version]);
  return rows[0] || null;
};

exports.query = query;
