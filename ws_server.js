const WebSocketServer = require('websocket').server;
const http = require('http');

const types = require("./types");
const utils = require("./utils");

let PLAYERS = [];
let ROOMS = [];
let connections = [];

const server = http.createServer((request, response) => {
    console.log((new Date()) + ' Received request for ' + request.url);
    response.writeHead(404);
    response.end();
});

server.listen(8080, function() {
    console.log((new Date()) + ' Server is listening on port 8080');
});

wsServer = new WebSocketServer({
    httpServer: server,
    // You should not use autoAcceptConnections for production
    // applications, as it defeats all standard cross-origin protection
    // facilities built into the protocol and the browser.  You should
    // *always* verify the connection's origin and decide whether or not
    // to accept it.
    autoAcceptConnections: false
});

function originIsAllowed(origin) {
    // put logic here to detect whether the specified origin is allowed.
    return true;
}

function setConnection(userid, connection) {
    if(!connections[userid]) {
        connections[userid] = connection;
    }
}

function sendToAllPlayers(roomid, data) {
    const room = ROOMS.find(room => room.id === roomid);
    if(room) {
        console.log(room.players)
        room.players.map((player, i) => {
            if(player.userid === '') {
                room.players = room.players.splice(i, 1);
            }
            if(connections[player.userid]) {
                if(player.userid !== '') {
                    console.log(player.userid)
                    console.log(connections[player.userid].state)
                    connections[player.userid].sendUTF(data);
                }
            } else {
                console.log(`connection not available`);
            }
        });
    } else {
        console.log('not available room')
        console.log(data)
    }
}

wsServer.on('request', function(request) {
    /*if (!originIsAllowed(request.origin)) {
        request.reject();
        console.log((new Date()) + ' Connection from origin ' + request.origin + ' rejected.');
        return;
    }*/

    const connection = request.accept('echo-protocol', request.origin);

    connection.on('message', (message) => {
        if(!message || !message.utf8Data || typeof message.utf8Data !== 'string' || message.utf8Data === 'undefined' || message.utf8Data === 'undefined:1') {
            console.log('problem with utf8 data');
            return;
        }
        const json = JSON.parse(message.utf8Data);
        const cmd = json.cmd;
        const data = json.data;

        if(cmd === types.COMMANDS.GAME_CREATE) {
            if(data.userId === '') {
                return;
            }
            setConnection(data.userId, connection);
            connection['userId'] = data.userId;
            if(data.username) {
                const player = {
                    initiator: data.initiator,
                    username: data.username,
                    userid: data.userId,
                    status: 'connected'
                };
                let room = null;
                if(data.initiator) {
                    room = {id: data._id, players: [player], status: 'LOBBY'};
                    ROOMS.push(room);
                } else {
                    room = ROOMS.find(room => data._id === room.id);
                    if(room) {
                        room.players.push(player)
                    } else {
                        console.log('room not available')
                    }
                }
                PLAYERS.push(player);
                connection['roomId'] = room.id;
                if(data.initiator) {
                    sendToAllPlayers(room.id, JSON.stringify({
                        cmd: types.COMMANDS.ROOM_CREATED,
                        data: room
                    }));
                } else {
                    sendToAllPlayers(room.id, JSON.stringify({
                        cmd: types.COMMANDS.ROOM_JOINED,
                        data: {
                            player,
                            room
                        }
                    }));
                }
            } else {
                console.log('no username')
            }
        }
    });

    connection.on('close', function(reasonCode, description) {
        console.log('closed')
        const room = ROOMS.find(room => room.id === connection.roomId);
        if(room) {
            room.players.map((player, i) => {
                if(player.userid === connection.userId) {
                    if(player.initiator) {
                        ROOMS.map((room, i) => {
                            if (room.id === connection.roomId && room.status !== 'playing') {
                                ROOMS = ROOMS.splice(i, 1);
                                sendToAllPlayers(connection.roomId, JSON.stringify({
                                    cmd: types.COMMANDS.GAME_OVER,
                                    data: connection.roomId
                                }));
                            }
                        });
                        sendToAllPlayers(connection.roomId, JSON.stringify({
                            cmd: types.COMMANDS.PLAYER_DISCONNECT,
                            data: {
                                room,
                                player,
                            }
                        }));
                    } else {
                        room.players[i].status = 'disconnect';
                        sendToAllPlayers(connection.roomId, JSON.stringify({
                            cmd: types.COMMANDS.PLAYER_DISCONNECT,
                            data: {
                                room,
                                player,
                            }
                        }));
                    }
                }
            });
        }
    });
});