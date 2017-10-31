const httpRoutes = require('./routes/http');
const socketRoutes = require('./routes/socket');

const app = require('../utils/app');
const io = require('../utils/io');

// 从配置文件获取服务器信息
const configs = require('../configs');

const config = configs.game_server();

// 开启HTTP服务
app(httpRoutes).listen(config.HTTP_PORT, config.FOR_HALL_IP, (err) => {
  if (!err) {
    console.log(`http server is listening on ${config.FOR_HALL_IP}:${config.HTTP_PORT}`);
  }
});

io(socketRoutes).listen(config.CLIENT_PORT, (err) => {
  if (!err) {
    console.log(`socket server is listening on port ${config.CLIENT_PORT}`);
  }
});