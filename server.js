// setup basic express server
var express = require('express');
var app = express();
var server = require('http').createServer(app);
var io = require('socket.io')();
var port = process.env.PORT || 3000;
var superagent = require('superagent');

io.attach(server);

server.listen(port, function () {
    console.log('Server listening at port %d', port);
});

// routing
app.use(express.static(__dirname + '/public'));

// chatroom
var numUsers = 0;
var participants = {};
var languages = {}
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
      // if direct chat request is received, message will be translated and passed to a selected person
        if(data.substr(0, 1) === '@') {
			var msg = data.substr(1);
			var indAt = msg.indexOf('@');
            var indSpace = msg.indexOf(' ');
			if(indSpace !== -1){
				var name = msg.substring(indAt + 1, indSpace);                
				var msg = msg.substring(indSpace + 1);
				if(name in participants) {
                    if(msg != ' ' && msg != ''){                        
                        //DEBUG
                        console.log('now the message [ '+msg+' ]' + 'will be translated...')
                        doTranslation(participants[name].userLanguage, msg, socket, function (connectedSocket, translatedText) {
                            participants[name].emit('whisper', {
                                msg: translatedText,
                                name: socket.username,
                            });
                        });
                    }else{
                        // No message entry received. Send an error log request to client side 
                        console.log('no message entry err 2');
                        msg = 'You did not enter any message.';
                        if(msg === 'You did not enter any message.'){
                            doTranslation(socket.userLanguage, msg, socket, function (connectedSocket, translatedText) {
                                socket.emit('errorMsg', {
                                    msg: translatedText,
                                    name: socket.username,
                                });
                            }); 
                        }
                    }
                }else{
                     // Wrong username specified. Send an error log request to client side (the space between username ) 
                     console.log('invalid user specified on whisper req err 1');
                     msg = 'That user is not online.';
                    if(msg === 'That user is not online.'){
                        doTranslation(socket.userLanguage, msg, socket, function (connectedSocket, translatedText) {
                            socket.emit('errorMsg', {
                            msg: translatedText,
                            name: socket.username,
                            });
                        });
                    }
                }
			} else {
				// Wrong username specified. Send an error log request to client side 
                console.log('no space between username and msg err 3');
                
                msg = 'Please enter a space between the username and message.';
                if(msg === 'Please enter a space between the username and message.'){
                    doTranslation(socket.userLanguage, msg, socket, function (connectedSocket, translatedText) {
                        socket.emit('errorMsg', {
                            msg: translatedText,
                            name: socket.username,
                        });
                    });
			     }
            }
		} else { // otherwise messages are sent to everyone
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

        if(username in participants) {
    		callback(false);
    	} else {
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
    });

   // keep track of who is logged on
   function updateParticipants() {
       console.log("obj type: "+ typeof(participants));
       users = [];
       for(key in participants) {
           var thisSocket = participants[key];
           console.log(' '+thisSocket.username + ' ' + thisSocket.userLanguage );
           users.push(
               {username: thisSocket.username,
                userLanguage: thisSocket.userLanguage
            });
        }
        // send list of usernames
    	io.sockets.emit('participants', Object.keys(participants));
        io.sockets.emit('participants', users);
    }

     // keep track of who is logged on
     function updateUsers() {
         console.log("obj type: "+ typeof(participants));
         users = [];
         for(key in participants) {
             var thisSocket = participants[key];
             console.log(' '+thisSocket.username + ' ' + thisSocket.userLanguage );
             users.push(
                 {username: thisSocket.username,
                  userLanguage: thisSocket.userLanguage
             });
         }
        // send list of users
        io.sockets.emit('users', users);
    }
});
