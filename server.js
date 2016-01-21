var express = require('express');
var app = express();
// Taken from the socket.io "Get Started"
var http = require('http').Server(app);
var io = require('socket.io')(http);

app.use(express.static('./client'));
app.use(express.static('./public'));

require('./api/routes')(app)

app.get('*', function (req, res) {
	res.sendFile('./client/views/index.html', { root: __dirname });
});

// Taken from the socket.io "Get Started"
io.on('connection', function(socket) {
	console.log('A user connected.');
	socket.on('disconnect', function() {
		console.log('A user disconnected.');
	});

	// socket.on('chat message', function(msg) {
	// 	console.log('Message: ' + msg);
	// });
});

http.listen(8080, function () {
	console.log('Server is running on 8080.');
});
