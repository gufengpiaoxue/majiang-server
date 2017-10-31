const app = require('../utils/app');
const configs = require('../configs');

const config = configs.hall_server();


app(require('./routes/client')).listen(config.CLEINT_PORT, (err) => {
  if (!err) {
    console.log(`server is listening on port ${config.CLEINT_PORT}`);
  }
});
app(require('./routes/room').start).listen(config.ROOM_PORT, (err) => {
  if (!err) {
    console.log(`server is listening on port ${config.ROOM_PORT}`);
  }
});