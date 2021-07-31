var roomID;
var isOBS;

window.location.pathname === "/testing/obs.html" ? isOBS = true : isOBS = false;

if (isOBS) {
  roomID = new URLSearchParams(window.location.hash.substring(1)).get("roomID")
  var wsUri = "ws://localhost:6503/?roomID=" + roomID;
  websocket = new WebSocket(wsUri, "OBS")
  websocket.onopen = function(evt) { onOpen(evt) };
  websocket.onclose = function(evt) { onClose(evt) };
  websocket.onmessage = function(evt) { onMessageOBS(evt) };
  websocket.onerror = function(evt) { onError(evt) };

  console.log("connecting as ID:", roomID)
  const p = new SimplePeer({
    channelName: roomID,
    initiator: false,
    trickle: false
  })
  
  p.on("signal", data => {
    console.log("got signal")

    websocket.send(JSON.stringify(data))
  })

  p.on('connect', data => {
    console.log("Connected!")
  })

  p.on('data', data => {
    const stringData = data.toString()
    console.log("got data!", data.toString())
    document.getElementById("inside").innerHTML += "<h2>" + stringData + "</h2>"
  })

  async function onMessageOBS(event) {
    let signalObj = await event.data.text().then((text) => JSON.parse(text))
    p.signal(signalObj)
  }
}

function connect() {
  roomID = document.getElementById("roomID").value
  console.log("connecting as ID:", roomID)
  var wsUri = "ws://localhost:6503?roomID=" + roomID;
  websocket = new WebSocket(wsUri, "UI")
  websocket.onopen = function(evt) { onOpen(evt) };
  websocket.onclose = function(evt) { onClose(evt) };
  websocket.onmessage = function(evt) { onMessageUI(evt) };
  websocket.onerror = function(evt) { onError(evt) };

  const p = new SimplePeer({
    channelName: roomID,
    initiator: true,
    trickle: false
  })

  p.on('signal', data => {
    console.log(data)
    websocket.send(JSON.stringify(data))
  })

  p.on('connect', data => {
    console.log("Connected!")
  })

  send = () => {
    console.log("sending")
    const dataToSend = document.getElementById("sendText").value
    p.send(dataToSend)
  }

  async function onMessageUI(event) {
    let signalObj = await event.data.text().then((text) => JSON.parse(text))
    p.signal(signalObj)
  }
}

function connectOBS() {
  roomID = window.location.hash.substring(1)
  
}

var send = () => {}

function onOpen(event) {
  console.log('opening')
}

function onClose(event) {
  console.log('closing')
}

function onMessage(event) {
  console.log('got message')
}

function onError(event) {
  console.log('got error')
}

