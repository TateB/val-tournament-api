const uuid = require('uuid')
var WebSocketServer = require('ws').Server
var wss = new WebSocketServer({ port: 6503 })

if (wss) {
    console.log("server online")
}

var connections = []

wss.on('connection', (ws, req) => {
    ws.id = uuid.v4()
    ws.roomID = new URLSearchParams(req.url.substr(1)).get("roomID")
    console.log("got connection to:", ws.roomID, ws.protocol)
    console.log("id:", ws.id)
    connections.push(ws)

    if (ws.protocol == "UI") {
        ws.on("message", (data) => {
            console.log(data)
            const obsRoom = connections.find(x => x.roomID === ws.roomID && x.protocol === "OBS")
            if (!obsRoom) return  // OBS Room doesn't exist yet
            obsRoom.send(data)
        })
    }

    if (ws.protocol == "OBS") {
        ws.on("message", (data) => {
            console.log(data)
            const uiRoom = connections.find(x => x.roomID === ws.roomID && x.protocol === "UI")
            if (!uiRoom) return
            uiRoom.send(data)
        })
    }

    ws.on("close", () => {
        connections = connections.filter(x => x.id !== ws.id)
    })
});