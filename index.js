var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({ port: 6503 });
const util = require("util");

if (wss) {
  console.log("server online");
}

var rooms = [];
/* Rooms
RoomID is native id for each
Each room has connections, which all will lead back to UI.

Room can only have ONE of each type of connection (protocol). 

*/

function Room(roomID) {
  this.roomID = roomID;
  this.UI = null;
  this.connections = [];
  this.offers = [];
}

function heartbeat() {
  this.isAlive = true;
}

function noop() {}

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
  const roomID = new URLSearchParams(req.url.substr(1)).get("roomID");
  console.log("got connection to:", roomID, ws.protocol);

  // If no roomID or protocol provided, terminate connection
  if (!roomID || !ws.protocol) {
    ws.send({ error: true, errorMessage: "Protocol already in use!" });
    ws.terminate();
  }

  const currentRoom = () => rooms.find((x) => x.roomID === roomID);
  const getConnection = (protocol) =>
    currentRoom().connections.find((x) => x.protocol === protocol);
  const getOffer = (protocol) =>
    currentRoom().offers.find((x) => x.protocol === protocol);
  const matchingUI = () => currentRoom().UI;
  const sendAsJSON = (sendto, obj) => sendto.send(JSON.stringify(obj));

  // Check if room exists and create/add current connection OR kick user since procotol exists in room
  if (
    currentRoom(roomID) &&
    currentRoom(roomID).connections.find((x) => x.protocol === ws.protocol) !=
      undefined
  ) {
    console.log(
      currentRoom(roomID).connections.find((x) => x.protocol === ws.protocol)
    );
    console.log("Protocol already in use:", ws.protocol);
    sendAsJSON(ws, { error: true, errorMessage: "Protocol already in use!" });
    ws.terminate();
  } else if (!currentRoom(roomID)) {
    console.log("Pushing new room for:", ws.protocol);
    rooms.push(new Room(roomID));
  }

  if (ws.protocol === "UI") {
    currentRoom().UI = ws;
  } else {
    currentRoom().connections.push(ws);
  }

  // Send offer if UI room already exists + added offer
  const offerToSend = getOffer(ws.protocol);
  if (matchingUI() && offerToSend && ws.protocol !== "UI") {
    console.log("Found UI waiting for response");
    sendAsJSON(ws, offerToSend.offer);
  } else if (matchingUI() && ws.protocol !== "UI") {
    console.log("there was no offer available for:", ws.protocol);
    sendAsJSON(ws, {
      error: true,
      errorMessage: "There was no available offer for this protocol.",
    });
  }

  ws.on("message", (data) => {
    let msgObj = JSON.parse(data.toString());
    if (ws.protocol === "UI") {
      // If is UI, either send offer to connection, or store offer in offers
      console.log("sending msg as UI to:", msgObj.protocol);
      const connWanted = getConnection(msgObj.protocol);
      connWanted
        ? sendAsJSON(connWanted, msgObj.offer)
        : currentRoom().offers.push(msgObj);
    } else {
      // If protocol isn't UI, send offer to UI
      console.log("sending msg as " + ws.protocol + " to UI");
      sendAsJSON(matchingUI(), msgObj);
    }
  });

  const interval = setInterval(function ping() {
    if (ws.isAlive === false) return ws.terminate();

    ws.isAlive = false;
    ws.ping(noop);
  }, 30000);

  ws.on("close", () => {
    clearInterval(interval);
    if (getConnection(ws.protocol) === ws) {
      console.log("Notifying and removing", ws.protocol);
      // If on connection close, WS is known connection, notify UI and remove connection from connections
      sendAsJSON(matchingUI(), { closed: true, protocol: ws.protocol });
      currentRoom().connections = currentRoom().connections.filter(
        (x) => x !== ws
      );
    } else if (ws.protocol === "UI") {
      console.log("UI Connection closed");
      // If connection close is UI, inform all connections of disconnect
      for (connection of currentRoom().connections) {
        sendAsJSON(connection, { closed: true });
      }
      // Clear current room of UI and offers
      currentRoom().UI = null;
      currentRoom().offers = [];
    }
  });
});
