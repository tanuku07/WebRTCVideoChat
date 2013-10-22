var WebSocketServer = require('ws').Server;

function WebRtcServer() {
    var wss,
        registerSockets = {},
        rooms = {},
        getCurrentRoom = function (id) {
            for (var room in rooms) {
                var members = rooms[room];
                for (var i = 0; i < members.length; i++) {
                    if (members[i] == id)
                        return room;
                }
            }
            return null;
        },
        listen = function (server) {
            wss = new WebSocketServer({server: server});
            wss.on('connection', function (ws) {
                ws.on('message', function (message) {
                    var packet = JSON.parse(message);
                    if (packet.eventName == 'register') {
                        ws.id = packet.data.clientId;
                        registerSockets[packet.data.clientId] = ws;
                        ws.send(JSON.stringify({
                            eventName: "register_response",
                            data: {status: "ok"}
                        }));
                    }

                    if (packet.eventName == "call") {
                        var clientSocket = registerSockets[packet.data.clientId];
                        if (clientSocket) {
                            console.log('socket found for: ' + packet.data.clientId);
                            clientSocket.send(JSON.stringify({
                                eventName: "call_request",
                                data: { from: packet.data.fromClientId, to: packet.data.clientId, status: "none", reason: ""}
                            }));
                        } else {
                            console.log('socket with client id ' + packet.data.clientId + ' not found!');
                            ws.send(JSON.stringify({
                                eventName: "call_response",
                                data: { from: packet.data.fromClientId, to: packet.data.clientId, status: "fail", reason: "user offline" }
                            }));
                        }
                    }

                    if (packet.eventName == "call_response") {
                        ws.send(JSON.stringify({
                            eventName: "call_response",
                            data: packet.data
                        }));
                    }

          if (packet.eventName == "got_user_media") {
            console.log("Call got user media ", packet.data.from);
            var fromClientSocket = registerSockets[packet.data.from];
            if (fromClientSocket) {
              fromClientSocket.send(JSON.stringify({eventName: "got_user_media"}));
            }
          }

                    if (packet.eventName == "call_accepted") {
                        var fromClientSocket = registerSockets[packet.data.from];
                        if (fromClientSocket) {
                            rooms[packet.data.room] = [packet.data.from,
                                packet.data.to];
                            fromClientSocket.send(JSON.stringify({eventName: "call_accepted_answer", data: packet.data}));
                        }
                    }

                    if (packet.eventName == "call_rejected") {
                        var fromClientSocket = registerSockets[packet.data.from];
                        if (fromClientSocket) {
                            fromClientSocket.send(JSON.stringify({eventName: "call_rejected_answer", data: packet.data}));
                        }
                    }

                    if(packet.eventName == "bye"){
                        var members = rooms[packet.data.room];
                        for (var i = 0, len = members.length; i < len; i++) {
                            var memberId = members[i];
                            if (memberId != ws.id) {
                                var fromClientSocket = registerSockets[memberId];
                                fromClientSocket.send(JSON.stringify(packet));
                            }
                        }

                        delete rooms[packet.data.room];
                    }

                    if (!packet.eventName) {
                        var room = getCurrentRoom(ws.id);
                        console.log('found room: ' + room);
                        var members = rooms[room];
                        for (var i = 0, len = members.length; i < len; i++) {
                            var memberId = members[i];
                            if (memberId != ws.id) {
                                var fromClientSocket = registerSockets[memberId];
                                fromClientSocket.send(JSON.stringify(packet));
                            }
                        }
                    }

                });
                ws.on('close', function () {
                    console.log('close socket: ' + ws.id);
                    delete registerSockets[ws.id];
                });
            });
        };

    return {
        listen: listen
    };
}

exports.WebRtcServer = WebRtcServer;
