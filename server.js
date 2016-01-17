var express = require('express');
var app = express();
var server = require('http').Server(app);

app.use(express.static('./client'));
app.use(express.static('public'));

require('./api/routes')(app)

app.get('*', function (req, res) {
	res.sendFile('/client/views/index.html', { root: __dirname });
});

var io = require('socket.io')(server);

app.listen(9091, function () {
	console.log('Server is running on 9091.')
});
