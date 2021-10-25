var WebSocketServer = require("ws").Server;
var wss = new WebSocketServer({ port: 6503 });
const util = require("util");

const dateStr = () =>
  new Date().toISOString().replace(/T/, " ").replace(/\..+/, "");
function systemLog(logInput) {
  console.log(
    `\x1b[90m[\x1b[31m${dateStr()}\x1b[90m][\x1b[91mSystem\x1b[90m]\x1b[0m: ${logInput}`
  );
}

if (wss) {
  systemLog("Server online.");
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

wss.on("connection", (ws, req) => {
  ws.isAlive = true;
  ws.on("pong", heartbeat);
  const roomID = new URLSearchParams(req.url.substr(1)).get("roomID");

  function connCommandLog(logInput) {
    console.log(
      `\x1b[90m[\x1b[31m${dateStr()}\x1b[90m][\x1b[92m${roomID.substr(
        0,
        8
      )}\x1b[90m][\x1b[93m${ws.protocol}\x1b[90m]\x1b[0m: ${logInput}`
    );
  }
  function roomCommandLog(logInput) {
    console.log(
      `\x1b[90m[\x1b[31m${dateStr()}\x1b[90m][\x1b[92m${roomID.substr(
        0,
        8
      )}\x1b[90m]\x1b[0m: ${logInput}`
    );
  }

  systemLog("Connection request recieved.");

  // If no roomID or protocol provided, terminate connection
  if (!roomID || !ws.protocol) {
    systemLog(
      `RoomID or protocol not provided, terminating new connection. (room: ${roomID}, protocol: ${ws.protocol})`
    );
    ws.send({ error: true, errorMessage: "Protocol already in use!" });
    ws.terminate();
  }

  const currentRoom = () => rooms.find((x) => x.roomID === roomID);
  const getConnection = (protocol) =>
    currentRoom().connections.find((x) => x.protocol === protocol);
  const getOffer = (protocol) =>
    currentRoom().offers.find((x) => x.protocol === protocol);
  const matchingUI = () => currentRoom().UI;
  const sendAsJSON = (sendto, obj) =>
    sendto === null ? undefined : sendto.send(JSON.stringify(obj));

  // Check if room exists and create/add current connection OR kick user since procotol exists in room
  if (
    currentRoom(roomID) &&
    currentRoom(roomID).connections.find((x) => x.protocol === ws.protocol) !=
      undefined
  ) {
    roomCommandLog(
      `Connection already exists for ${ws.protocol}, terminating new connection.`
    );
    sendAsJSON(ws, { error: true, errorMessage: "Protocol already in use!" });
    ws.terminate();
  } else if (!currentRoom(roomID)) {
    roomCommandLog("Fresh roomID, creating room object.");
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
    connCommandLog("Found matching UI offer, awaiting response.");
    sendAsJSON(ws, offerToSend.offer);
  } else if (matchingUI() && ws.protocol !== "UI") {
    connCommandLog("No matching offer was found.");
    sendAsJSON(ws, {
      error: true,
      errorMessage: "There was no available offer for this protocol.",
    });
  }

  ws.on("message", (data) => {
    let msgObj = JSON.parse(data.toString());
    if (msgObj.reset) {
      roomCommandLog(
        "Reset request recieved, forcing offer regeneration from all connections."
      );
      for (connection of currentRoom().connections) {
        sendAsJSON(connection, { closed: true });
        sendAsJSON(ws, { closed: true, protocol: ws.protocol });
      }
    }
    if (ws.protocol === "UI") {
      // If is UI, either send offer to connection, or store offer in offers
      connCommandLog(
        `Recieved generated offer for ${msgObj.protocol}, sending to match or adding to store.`
      );
      const connWanted = getConnection(msgObj.protocol);
      connWanted
        ? sendAsJSON(connWanted, msgObj.offer)
        : currentRoom().offers.push(msgObj);
    } else {
      // If protocol isn't UI, send offer to UI
      connCommandLog("Recieved generated offer, sending to UI.");
      sendAsJSON(matchingUI(), msgObj);
    }
  });

  // Heartbeat interval for checking connection
  ws.interval = setInterval(function ping() {
    // If pong hasn't returned after 70 seconds, terminate connection and remove from room
    if (!ws.isAlive) {
      connCommandLog("Heartbeat not recieved.");
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  }, 30000);

  ws.on("close", (code, reason) => {
    clearInterval(ws.interval);
    ws.protocol === "UI"
      ? closeUIConnection(reason.toString())
      : closeConnection(reason.toString());
  });

  // Function for closing connections. Logs, notifies UI, and removes connection from room.
  function closeConnection(errMsg = "") {
    connCommandLog(
      `Connection closed, notifying UI and removing. (msg: ${errMsg})`
    );
    // If on connection close, WS is known connection, notify UI and remove connection from connections
    sendAsJSON(matchingUI(), { closed: true, protocol: ws.protocol });
    currentRoom().connections = currentRoom().connections.filter(
      (x) => x !== ws
    );
  }

  // Function for closing UI connection. Logs, notifies room connections, and clears room.
  function closeUIConnection(errMsg = "") {
    connCommandLog(
      `Connection closed, notifying connections and clearing room. (msg: ${errMsg})`
    );
    // If connection close is UI, inform all connections of disconnect
    for (connection of currentRoom().connections) {
      sendAsJSON(connection, { closed: true });
    }
    // Clear current room of UI and offers
    currentRoom().UI = null;
    currentRoom().offers = [];
  }
});
