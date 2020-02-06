const express = require('express');
const app = express();
const config = require('./config');

app.use('/', require('./api'));


const server = app.listen(config.get('PORT'), function () {
   var host = server.address().address
   var port = server.address().port
   
   console.log("Example app listening at http://%s:%s", host, port)
})