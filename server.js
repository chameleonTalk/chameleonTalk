// Setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')();
var port = process.env.PORT || 3000;
var superagent = require('superagent');
// var bodyParser = require('body-parser');

io.attach(server);

server.listen(port, function () {
  console.log('Server listening at port %d', port);
});

// Routing
app.use(express.static(__dirname + '/public'));

// Chatroom
var numUsers = 0;
var users = [];

// Helps parse the POST body.
// app.use(bodyParser.urlencoded({
//     extended: true
// }));
// app.use(bodyParser.json());
//
// app.post('/language', function (request, response) {
//     targetLang = request.body.languagePreference;
// });

// Translates source text into the targeted language.
function doTranslation(targetLang, sourceText, socket, callback) {
    superagent
        .get('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + targetLang + '&dt=t&q=' + sourceText)
        .end(function (err, res) {
            var rawStr = err.rawResponse;

            var str = rawStr.replace(/,,/g, ',0,');
            str = str.replace(/,,/g, ',0,');

            var result = JSON.parse(str);

            return callback(socket, result[0][0][0]);
        });
}

io.on('connection', function (socket) {
  var addedUser = false;

  // when the client emits 'new message', this listens and executes
  socket.on('new message', function (data) {
    // Translates data (original text). Once response is received, emits.
    for (key in io.sockets.connected) {
        var connectedSocket = io.sockets.connected[key];
        if (socket.id != connectedSocket.id) {
            // Need to pass connectedSocket into doTranslation to maintain its value.
            doTranslation(connectedSocket.userLanguage, data, connectedSocket, function (connectedSocket, translatedText) {
                connectedSocket.emit('new message', {
                    username: socket.username,
                    message: translatedText
                });
            });
        }
    }
  });

  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username, language) {
    if (addedUser) return;

      // we store the username in the socket session for this client
    socket.username = username;
  	socket.userLanguage = language;

    var user = { username: socket.username, language : socket.userLanguage};

    users.push(user);

    ++numUsers;
    addedUser = true;
    socket.emit('login', {
      numUsers: numUsers
    });
    // echo globally (all clients) that a person has connected
    socket.broadcast.emit('user joined', {
      username: socket.username,
      numUsers: numUsers
      });
  });

  // when the client emits 'typing', we broadcast it to others
  socket.on('typing', function () {
    socket.broadcast.emit('typing', {
      username: socket.username
    });
  });

  // when the client emits 'stop typing', we broadcast it to others
  socket.on('stop typing', function () {
    socket.broadcast.emit('stop typing', {
      username: socket.username
    });
  });

  // when the user disconnects.. perform this
  socket.on('disconnect', function () {
    if (addedUser) {
      --numUsers;

      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  });
});
