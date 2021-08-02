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
    const index = connections.push(ws) - 1 // get index for current WS + push into connections array

    const matchingUI = connections.find(x => x.roomID === ws.roomID && x.rtcData && x.protocol === "UI")
    if (matchingUI) {
        console.log("matching exists")
        ws.send(matchingUI.rtcData)
    }

    ws.on("message", (data) => {
        if (ws.protocol === "UI" || ws.protocol === "OBS") {
            const matchingRoom = connections.find(x => x.roomID === ws.roomID && x.protocol !== ws.protocol)
            if (!matchingRoom) {
                console.log("no matching room")
                ws.rtcData = data
                connections[index] = ws
                // OBS Room doesn't exist yet
                return
            }
            console.log("matching room, sending for NOT", ws.protocol)
            matchingRoom.send(data)
        }
    }) 

    ws.on("close", () => {
        console.log("closed connection")
        const matchingRoom = connections.find(x => x.roomID === ws.roomID && x.protocol !== ws.protocol)
        if (matchingRoom) {
            matchingRoom.send(JSON.stringify({closed: true}))
        }

        connections = connections.filter(x => x.id !== ws.id)
    })
});