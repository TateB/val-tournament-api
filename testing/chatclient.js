var roomID;
var isOBS;
var obsPeer;

window.location.pathname === "/testing/obs.html" ? isOBS = true : isOBS = false;

if (isOBS) {
  roomID = new URLSearchParams(window.location.hash.substring(1)).get("roomID")
  var wsUri = "ws://localhost:6503/?roomID=" + roomID;
  websocket = new WebSocket(wsUri, "OBS")
  websocket.onopen = function(evt) { onOpen(evt) };
  websocket.onclose = function(evt) { onClose(evt) };
  websocket.onmessage = function(evt) { onMessageOBS(evt) };
  websocket.onerror = function(evt) { onError(evt) };
  obsPeer = new connectOBS(websocket)

  async function onMessageOBS(event) {
    console.log("got signal")
    console.log(event.data)
    if (event.data instanceof Blob) {
      console.log("was blob, can signal")
      console.log(obsPeer)
      let signalObj = await event.data.text().then((text) => JSON.parse(text))
      obsPeer.signal(signalObj) // this is not working for second connection
    } else {
      console.log("destroying")
      obsPeer.destroy()
    }
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


function connectOBS(websocket) {
  console.log("connecting as ID:", roomID)
  var p = new SimplePeer({
    channelName: roomID,
    initiator: false,
    trickle: false
  })

  p._debug = console.log
  
  p.on("signal", data => {
    console.log("got signal", data)

    const sentSocket = websocket.send(JSON.stringify(data))
    console.log("Sent socket for signal:", sentSocket)
  })

  p.on('connect', data => {
    console.log("Connected!")
  })

  p.on('data', data => {
    const stringData = data.toString()
    console.log("got data!", data.toString())
    document.getElementById("inside").innerHTML += "<h2>" + stringData + "</h2>"
  })

  p.on('close', data => {
    console.log("connection closed")
    console.log()
    p.removeAllListeners();
    console.log("reconnecting")
    obsPeer = null;
    obsPeer = new connectOBS(websocket)
  })

  return p
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

