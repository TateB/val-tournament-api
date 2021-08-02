var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({ port: 6503 })

if (wss) {
    console.log("server online")
}

var rooms = []
/* Rooms
RoomID is native id for each
Each room has connections, which all will lead back to UI.

Room can only have ONE of each type of connection (protocol). 

*/

function Room(roomID) {
    this.roomID = roomID
    this.UI = null
    this.connections = []
    this.offers = []
}

wss.on('connection', (ws, req) => {
    const roomID = new URLSearchParams(req.url.substr(1)).get("roomID")
    console.log("got connection to:", roomID, ws.protocol)

    // If no roomID or protocol provided, terminate connection
    if (!roomID || !ws.protocol) {
        ws.send({ error: true, errorMessage: "Protocol already in use!" })
        ws.terminate()
    }

    const currentRoom = () => rooms.find(x => x.roomID === roomID)
    const getConnection = (protocol) => currentRoom().connections.find(x => x.protocol === protocol)
    const getOffer = (protocol) => currentRoom().offers.find(x => x.protocol === protocol)
    const matchingUI = () => currentRoom().UI
    const sendAsJSON = (sendto, obj) => sendto.send(JSON.stringify(obj))

    // Check if room exists and create/add current connection OR kick user since procotol exists in room
    if (currentRoom(roomID) && currentRoom(roomID).connections.find(x => x.protocol === ws.protocol)) {
        sendAsJSON(ws, { error: true, errorMessage: "Protocol already in use!" })
        ws.terminate()
    } else if (!currentRoom(roomID)) {
        rooms.push(new Room(roomID))
    }
    
    // Index of current connection
    const index = currentRoom().connections.push(ws) - 1

    // Send offer if UI room already exists + added offer
    const offerToSend = getOffer(ws.protocol)
    if (matchingUI() && offerToSend) {
        console.log("Found UI waiting for response")
        ws.send(offerToSend.offer)
    } else if (matchingUI()) {
        sendAsJSON(ws, { error: true, errorMessage: "There was no available offer for this protocol." })
    }

    ws.on("message", (data) => {
        if (ws.protocol === "UI") {
            // If is UI, either send offer to connection, or store offer in offers
            const connWanted = getConnection(data.protocol)
            connWanted ? connWanted.send(data.offer) : currentRoom().offers.push(data)
        } else {
            // If protocol isn't UI, send offer to UI
            matchingUI().send(data)
        }
    }) 

    ws.on("close", () => {
        if (getConnection(ws.protocol) === ws) {
            // If on connection close, WS is known connection, notify UI and remove connection from connections
            sendAsJSON(matchingUI(), { closed: true, protocol: ws.protocol })
            currentRoom().connections = currentRoom().connections.filter(x => x !== ws)
        } else if (ws.protocol === "UI") {
            // If connection close is UI, inform all connections of disconnect 
            for (connection of currentRoom().connections) {
                sendAsJSON(connection, { closed: true })
            }
            // Clear current room of UI and offers 
            currentRoom().UI = null
            currentRoom().offers = []
        }
    })
});