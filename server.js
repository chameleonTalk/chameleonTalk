var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static('./client'));
app.use(express.static('./public'));

require('./api/routes')(app)

app.get('*', function (req, res) {
	res.sendFile('/client/views/index.html', { root: __dirname });
});

app.listen(8080, function () {
	console.log('Server is running on 8080.');
});
