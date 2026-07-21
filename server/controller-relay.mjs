import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { WebSocket, WebSocketServer } from 'ws'

const PORT = Number(process.env.UPGRADVERSE_RELAY_PORT || 8051)
const sessions = new Map()

function lanAddresses() {
  return Object.values(networkInterfaces())
    .flat()
    .filter((entry) => entry && entry.family === 'IPv4' && !entry.internal)
    .map((entry) => entry.address)
    .sort((a, b) => Number(b.startsWith('192.168.')) - Number(a.startsWith('192.168.')))
}

function json(response, status, payload) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

const server = createServer((request, response) => {
  if (request.url === '/network-info') {
    json(response, 200, { port: PORT, addresses: lanAddresses() })
    return
  }
  if (request.url === '/health') {
    json(response, 200, { ok: true, sessions: sessions.size })
    return
  }
  json(response, 404, { error: 'Not found' })
})

const websocketServer = new WebSocketServer({ server })

function send(socket, message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function sessionState(sessionId) {
  if (!sessions.has(sessionId)) sessions.set(sessionId, { host: null, controller: null })
  return sessions.get(sessionId)
}

function publishStatus(sessionId) {
  const state = sessions.get(sessionId)
  if (!state) return
  const connected = Boolean(state.host && state.controller)
  send(state.host, { type: 'status', state: connected ? 'connected' : 'waiting', connected })
  send(state.controller, { type: 'status', state: connected ? 'connected' : 'waiting', connected })
}

function unregister(socket) {
  const { sessionId, role } = socket.upgradVerse || {}
  if (!sessionId || !role) return
  const state = sessions.get(sessionId)
  if (!state) return
  if (state[role] === socket) state[role] = null
  if (!state.host && !state.controller) sessions.delete(sessionId)
  else publishStatus(sessionId)
}

websocketServer.on('connection', (socket) => {
  socket.isAlive = true
  socket.on('pong', () => { socket.isAlive = true })
  socket.on('message', (raw) => {
    let message
    try { message = JSON.parse(raw.toString()) } catch { return }

    if (message.type === 'register') {
      const role = message.role === 'host' ? 'host' : message.role === 'controller' ? 'controller' : null
      const sessionId = String(message.session || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64)
      if (!role || !sessionId) {
        send(socket, { type: 'error', error: 'Invalid registration.' })
        return
      }
      unregister(socket)
      socket.upgradVerse = { role, sessionId }
      const state = sessionState(sessionId)
      if (state[role] && state[role] !== socket) state[role].close(4001, 'Replaced by a new peer.')
      state[role] = socket
      publishStatus(sessionId)
      return
    }

    const { role, sessionId } = socket.upgradVerse || {}
    const state = sessions.get(sessionId)
    if (!state) return
    if (role === 'controller' && ['snapshot', 'action'].includes(message.type)) send(state.host, message)
    if (role === 'host' && message.type === 'haptic') send(state.controller, message)
  })
  socket.on('close', () => unregister(socket))
  socket.on('error', () => unregister(socket))
})

const heartbeat = setInterval(() => {
  websocketServer.clients.forEach((socket) => {
    if (!socket.isAlive) return socket.terminate()
    socket.isAlive = false
    socket.ping()
  })
}, 15000)

server.listen(PORT, '0.0.0.0', () => {
  const addresses = lanAddresses()
  console.log(`[upGradVerse relay] ws://127.0.0.1:${PORT}`)
  addresses.forEach((address) => console.log(`[upGradVerse relay] ws://${address}:${PORT}`))
})

function shutdown() {
  clearInterval(heartbeat)
  websocketServer.clients.forEach((socket) => socket.close(1001, 'Server stopping.'))
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

