const app = require('../utils/app');
const routes = require('./routes');
const configs = require('../configs');

const config = configs.account_server();

app(routes).listen(config.CLIENT_PORT, (err) => {
  if (!err) {
    console.log(`server is listening on port ${config.CLIENT_PORT}`);
  }
});