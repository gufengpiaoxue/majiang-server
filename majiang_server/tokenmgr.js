const crypto = require('../utils/crypto');

const tokens = {};
const users = {};

exports.createToken = (userId, lifeTime) => {
  let token = users[userId];
  if (token != null) {
    this.delToken(token);
  }

  const time = Date.now();
  token = crypto.md5(`${userId}!@#$%^&${time}`);
  tokens[token] = {
    userId,
    time,
    lifeTime
  };
  users[userId] = token;
  return token;
};

exports.getToken = userId => users[userId];

exports.getUserID = token => tokens[token].userId;

exports.isTokenValid = (token) => {
  const info = tokens[token];
  if (info == null) {
    return false;
  }
  if (info.time + info.lifetime < Date.now()) {
    return false;
  }
  return true;
};

exports.delToken = (token) => {
  const info = tokens[token];
  if (info != null) {
    tokens[token] = null;
    users[info.userId] = null;
  }
};
