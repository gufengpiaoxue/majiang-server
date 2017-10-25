var client_service = require("./client_service");
var room_service = require("./room_service");
var CONFIG_PATH = process.env.CONFIG_PATH;

var configs = require(CONFIG_PATH);
var config = configs.hall_server();

var db = require('../utils/db');
db.init(configs.mysql());

client_service.start(config);
room_service.start(config);