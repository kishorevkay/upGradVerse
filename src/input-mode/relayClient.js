export class PhoneRelayClient extends EventTarget {
  constructor({ session, relayUrl }) {
    super()
    this.session = session
    this.relayUrl = relayUrl
    this.socket = null
    this.closed = false
    this.retryTimer = 0
  }

  connect() {
    if (this.closed || this.socket?.readyState === WebSocket.OPEN || this.socket?.readyState === WebSocket.CONNECTING) return
    this.emit('status', { state: 'connecting', connected: false })
    this.socket = new WebSocket(this.relayUrl)
    this.socket.addEventListener('open', () => {
      this.send({ type: 'register', role: 'host', session: this.session })
      this.emit('status', { state: 'waiting', connected: false })
    })
    this.socket.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data)
        if (message.type === 'status') this.emit('status', message)
        else if (message.type === 'snapshot') this.emit('snapshot', message.payload)
        else if (message.type === 'action') this.emit('action', message.payload)
      } catch (error) {
        console.warn('[upGradVerse input] Ignored malformed relay message.', error)
      }
    })
    this.socket.addEventListener('close', () => {
      this.emit('status', { state: 'offline', connected: false })
      if (!this.closed) this.retryTimer = window.setTimeout(() => this.connect(), 1300)
    })
    this.socket.addEventListener('error', () => this.socket?.close())
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(message))
  }

  sendHaptic(pattern = 'tap') {
    this.send({ type: 'haptic', payload: { pattern } })
  }

  close() {
    this.closed = true
    window.clearTimeout(this.retryTimer)
    this.socket?.close()
  }

  emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}

