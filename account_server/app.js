var db = require('../utils/db');
var CONFIG_PATH = process.env.CONFIG_PATH;
var configs = require(CONFIG_PATH);

//init db pool.
db.init(configs.mysql());

//

var config = configs.account_server();
var as = require('./account_server');
as.start(config);

var dapi = require('./dealer_api');
dapi.start(config);