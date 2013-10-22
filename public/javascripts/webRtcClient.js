function WebRtcClient() {
    var subscribers = {},
        webSocket = null,
        myId = null,
    oponent = null,
        localStream,
        currentRoom,
    isCaller = false,
        isStarted = false,
        pc = null,
        pc_config,
        pc_constraints,
        sdpConstraints,
        init = function () {
            pc_config = webrtcDetectedBrowser === 'firefox' ?
            {'iceServers': [
                {'url': 'stun:23.21.150.121'}
            ]} : // number IP
            {'iceServers': [
                {'url': 'stun:stun.l.google.com:19302'}
            ]};

            pc_constraints = {
                'optional': [
                    {'DtlsSrtpKeyAgreement': true},
                    {'RtpDataChannels': true}
                ]};


            sdpConstraints = {'mandatory': {
                'OfferToReceiveAudio': true,
                'OfferToReceiveVideo': true }};

            var wsUrl = "ws:" + window.location.href.substring(window.location.protocol.length).split('#')[0];
            webSocket = new WebSocket(wsUrl);

            subscribe('offline', function(){
                $('div.status').text('status: offline');
            });

            subscribe('register_response', function(data, socket){
                $('div.status').text('registration: ' + data.status);
            });

            subscribe('connected', function(socket){
                $.ajax({
                    type : "GET",
                    url : "/getUserName"
                }).done(function(data){
                        if(data.username)
                            webRtcClient.register(data.username);
                    });
            });

            subscribe('call_response', function(data){
                $('<div />').html(data.reason).dialog({
                    modal: true,
                    buttons: {
                        Ok: function() {
                            $( this ).dialog( "close" );
                        }
                    }
                });
            });

            subscribe('call_request', function(data){
                console.log('call_request: ' + JSON.stringify(data));
                $('<div />').html(' call from: ' + data.from).dialog({
                    modal: true,
                    buttons: {
                        Answer: function() {
              oponent = data.from;
              webRtcClient.setInitiator(false);
              console.log("answer button pressed");
                            data.status = "accepted";
                            data.room = "super_room";
                            webRtcClient.acceptCall(data);
                            $( this ).dialog( "close" );
                        },
                        Decline: function(){
                            data.status = "rejected";
                            data.reason = "User busy";
                            webRtcClient.rejectCall(data);
                            $( this ).dialog( "close" );
                        }
                    }
                });
            });

            subscribe('call_accepted_answer', function(data){
        console.log("call accepted answer rised", data.from);
                webRtcClient.startCall(data.room);
            });


            subscribe('call_rejected_answer', function(data){
                $('<div />').html(' call rejected by:' + data.to + '!!! reason: ' + data.reason).dialog({
                    modal: true,
                    buttons: {
                        Ok: function() {
                            $( this ).dialog( "close" );
                        }
                    }
                });
            });


            subscribe('got_user_media', function () {
        if (!isCaller) {
                maybeStart();
          console.log("Peer Connection Ready state: ", pc.readyState);
        }
            });

            subscribe('offer', function (data) {
        console.log("offer");
                    maybeStart();
                pc.setRemoteDescription(new RTCSessionDescription(data));
        console.log("Peer Connection Ready state: ", pc.readyState);
                doAnswer();
        console.log("Remote session description: ", data);
            });

            subscribe('answer', function (data) {
        console.log("answer");
                pc.setRemoteDescription(new RTCSessionDescription(data));
        console.log("Peer Connection Ready state: ", pc.readyState);
        console.log("Remote session description: ", data);
            });

            subscribe('candidate', function (data) {
        console.log("Peer Connection Ready state: ", pc.readyState);
        console.log('Received message ', data);
                var candidate = new RTCIceCandidate({sdpMLineIndex: data.label,
                    candidate: data.candidate});
                pc.addIceCandidate(candidate);
            });

            subscribe('bye', function(data){
                if(pc){
                    pc.close();
                    pc = null;
                }
            });

            webSocket.onopen = function () {
                console.log('connected');
                webSocket.send(JSON.stringify({eventName: 'ping', data: {} }));
                publish('connected', webSocket);
            };

            webSocket.onclose = function () {
                console.log('disconnected');
                publish('offline');
            };

            webSocket.onmessage = function (message) {
                var info = JSON.parse(message.data);
                if (info.eventName) {
                    publish(info.eventName, info.data, webSocket);
                } else {
                    publish(info.type, info, webSocket);
                }
            };

        },
        sendData = function (data) {
            webSocket.send(JSON.stringify(data));
        },
        register = function (id) {
            myId = id;
            sendData({eventName: "register", data: { clientId: id }});
        },
        call = function (id) {
      oponent = id;
      webRtcClient.setInitiator(true);
            sendData({eventName: "call", data: { fromClientId: myId, clientId: id }});
        },
        subscribe = function (eventName, callback) {
            subscribers[eventName] = subscribers[eventName] || [];
            subscribers[eventName].push(callback);
        },
        publish = function (eventName, _) {
            var events = subscribers[eventName];
            var args = Array.prototype.slice.call(arguments, 1);

            if (!events) {
                return;
            }

            for (var i = 0, len = events.length; i < len; i++) {
                events[i].apply(null, args);
            }
        },
        acceptCall = function (data) {
            console.log("call_accepted " + JSON.stringify(data));
      var response = {eventName: "call_accepted", data: data};
            startCall(data.room, function(){
                sendData(response);
            });
        },
        rejectCall = function (data) {
            console.log("call_rejected " + JSON.stringify(data));
      var response = {eventName: "call_rejected", data: data}
            sendData(response);
        },

        getLocalVideoTag = function () {
            return document.getElementById("localVideo");
        },
        getRemoteVideoTag = function () {
            return document.getElementById("remoteVideo");
        },

        handleIceCandidate = function (event) {
            console.log('handleIceCandidate event: ', event);
      console.log("event candidate", event.candidate);
      console.log("Peer Connection Ready state: ", pc.readyState);
            if (event.candidate) {
                sendData({
                    type: 'candidate',
                    label: event.candidate.sdpMLineIndex,
                    id: event.candidate.sdpMid,
                    candidate: event.candidate.candidate,
                });
            } else {
                console.log('End of candidates.');
            }
        },
        handleRemoteStreamRemoved = function (event) {
            console.log('Remote stream removed. Event: ', event);
        },
        handleRemoteStreamAdded = function (event) {
            console.log('Remote stream added.');
            var remoteVideo = getRemoteVideoTag();
      attachMediaStream(remoteVideo, event.stream);
            remoteStream = event.stream;
        },
        createPeerConnection = function () {
            try {
        pc = new RTCPeerConnection(pc_config);
                pc.onaddstream = handleRemoteStreamAdded;
                pc.onremovestream = handleRemoteStreamRemoved;
        pc.onicecandidate = handleIceCandidate;
                console.log('Created RTCPeerConnnection');
            } catch (e) {
                console.log('Failed to create PeerConnection, exception: ' + e.message);
                alert('Cannot create RTCPeerConnection object.');
                return;
            }
        },
        setLocalAndSendMessage = function (sessionDescription) {
      sessionDescription.sdp = preferISAC(sessionDescription.sdp);
            pc.setLocalDescription(sessionDescription);
      console.log('Local session description: ', sessionDescription);
            sendData(sessionDescription);
        },
        doCall = function () {
      console.log('Sending offer to peer', oponent);
            pc.createOffer(setLocalAndSendMessage, function (error) {
                console.log(error);
      }, sdpConstraints);
        },
        doAnswer = function () {
            console.log('Sending answer to peer.');
      pc.createAnswer(setLocalAndSendMessage, function (error) {
        console.log(error);
      }, sdpConstraints);
        },

        maybeStart = function () {
            if (!isStarted && typeof localStream != 'undefined') {
                createPeerConnection();
                pc.addStream(localStream);
        isStarted = true;
        console.log('isInitiator', isCaller);
        if (!isCaller) {
          doCall();
        }
      }
    },

    handleLocalUserMedia = function (localMediaStream) {
      localStream = localMediaStream;
      console.log('Attaching local stream to video tag.');
      var localVideoTag = getLocalVideoTag();
      attachMediaStream(localVideoTag, localMediaStream);
      console.log('sending got_user_media ', currentRoom, myId);
      sendData({ eventName: 'got_user_media', data: { room: currentRoom, from: oponent }});
    },
    mergeConstxraints = function (cons1, cons2) {
      var merged = cons1;
      for (var name in cons2.mandatory) {
        merged.mandatory[name] = cons2.mandatory[name];
      }
      merged.optional.concat(cons2.optional);
      return merged;
    },
    preferISAC = function (sdp) {
      var sdpLines = sdp.split('\r\n');
      var mLineIndex;
      for (var i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('m=audio') !== -1) {
          mLineIndex = i;
          break;
        }
      }
      if (mLineIndex === null) {
        return sdp;
      }

      for (i = 0; i < sdpLines.length; i++) {
        if (sdpLines[i].search('ISAC/16000') !== -1) {
          var opusPayload = extractSdp(sdpLines[i], /:(\d+) ISAC\/16000/i);
          if (opusPayload) {
            sdpLines[mLineIndex] = setDefaultCodec(sdpLines[mLineIndex], opusPayload);
          }
          break;
        }
      }

      sdpLines = removeCN(sdpLines, mLineIndex);

      sdp = sdpLines.join('\r\n');
      return sdp;
    },

    extractSdp = function (sdpLine, pattern) {
      var result = sdpLine.match(pattern);
      return result && result.length === 2 ? result[1] : null;
    },

    setDefaultCodec = function (mLine, payload) {
      var elements = mLine.split(' ');
      var newLine = [];
      var index = 0;
      for (var i = 0; i < elements.length; i++) {
        if (index === 3) { // Format of media starts from the fourth.
          newLine[index++] = payload; // Put target payload to the first.
        }
        if (elements[i] !== payload) {
          newLine[index++] = elements[i];
        }
      }
      return newLine.join(' ');
    },

  // Strip CN from sdp before CN constraints is ready.
    removeCN = function (sdpLines, mLineIndex) {
      var mLineElements = sdpLines[mLineIndex].split(' ');
      // Scan from end for the convenience of removing an item.
      for (var i = sdpLines.length - 1; i >= 0; i--) {
        var payload = extractSdp(sdpLines[i], /a=rtpmap:(\d+) CN\/\d+/i);
        if (payload) {
          var cnPos = mLineElements.indexOf(payload);
          if (cnPos !== -1) {
            // Remove CN payload from m line.
            mLineElements.splice(cnPos, 1);
          }
          // Remove CN line in sdp
          sdpLines.splice(i, 1);
        }
      }

      sdpLines[mLineIndex] = mLineElements.join(' ');
      return sdpLines;
    },

    startCall = function (room, callBack) {
      currentRoom = room;
      console.log("Start call function is called.");
      var constraints = {video: true, audio: true};
      navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia;
      navigator.getUserMedia(constraints,
        function (localMediaStream) {
          handleLocalUserMedia(localMediaStream);
          if (callBack)
            callBack();
        },
        function (error) {
          console.log("Error occured in startCall : " + error);
        });
    },

    setInitiator = function (value) {
      isCaller = value;
    },
    hangup = function () {
      if (pc) {
        sendData({ eventName: "bye", data: {room: currentRoom, from: myId}});
        pc.close();
        pc = null;
      }
    };

  return {
    init: init,
    register: register,
    subscribe: subscribe,
    publish: publish,
    call: call,
    acceptCall: acceptCall,
    rejectCall: rejectCall,
    startCall: startCall,
    setInitiator: setInitiator,
    hangup: hangup
  };
}
