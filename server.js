// setup basic express server
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

// routing
app.use(express.static(__dirname + '/public'));

// chatroom
var numUsers = 0;
var participants = {};
var users = [];

// translates source text into the targeted language.
function doTranslation(targetLang, sourceText, socket, callback) {

    superagent.get('https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=' + targetLang + '&dt=t&q=' + sourceText)
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
      
      // if direct chat request is received, msg will be translated and passed to a selected person 
      if(data.substr(0,1) === '@'){
          console.log('@ found');
			var msg = data.substr(1);
			var indAt = msg.indexOf('@');
            var indSpace = msg.indexOf(' ');
			if(indSpace !== -1){
                console.log('@ + space found')
				var name = msg.substring(indAt+1, indSpace);
                console.log("name parsed: " + name);
				var msg = msg.substring(indSpace + 1);
				if(name in participants){
                    doTranslation(participants[name].userLanguage, msg, socket, function (connectedSocket, translatedText) {
                    console.log('message sent is: ' + msg);
                    console.log('Whisper!');
                        participants[name].emit('whisper', {
                            msg: translatedText,
                            name: socket.username,
                        });
                    });
                }
                    else{
					//callback('Error!  Did you enter a valid user? Try again!');
                        console.log('invalid user specified on whisper req');
				}
			} else{
				//callback('Error!  Did you enter a message for your whisper? Try again!');
                        console.log('invalid message! (whisper req)');
			}
		} else{ // otherwise messages are sent to everyone
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
		}

  });


  // when the client emits 'add user', this listens and executes
  socket.on('add user', function (username, language, callback) {
      
    if (addedUser) return;
      
    if(username in participants){
		callback(false);
	}else{
		callback(true);

        // we store the username in the socket session for this client
        socket.username = username;
        socket.userLanguage = language;
        participants[socket.username]=socket;
        updateParticipants();
        ++numUsers;
        addedUser = true;
        
        console.log("user name: " + socket.username + "\t user language: " + socket.userLanguage + "\t socket id: " + socket.id );
        
        socket.emit('login', {
          numUsers: numUsers
        });
        
        // echo globally (all clients) that a person has connected
        socket.broadcast.emit('user joined', {
          username: socket.username,
          numUsers: numUsers,
          userLanguage: socket.userLanguage
        });
    }
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
		delete participants[socket.username];
		updateParticipants();
      // echo globally that this client has left
      socket.broadcast.emit('user left', {
        username: socket.username,
        numUsers: numUsers
      });
    }
  })

   // keep track of who is logged on
   function updateParticipants(){
    console.log("Who's on the list: "+Object.keys(participants));
    // send list of usernames 
	io.sockets.emit('participants', Object.keys(participants));
  }
});
