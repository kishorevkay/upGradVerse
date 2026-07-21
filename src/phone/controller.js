import '../phone/controller.css'

const params = new URLSearchParams(location.search)
const session = params.get('session') || ''
const relayUrl = params.get('relay') || ''
const BUTTON_COUNT = 19
const axes = [0, 0, 0, 0]
const buttons = Array.from({ length: BUTTON_COUNT }, () => ({ pressed: false, touched: false, value: 0 }))

const connection = document.querySelector('#phone-connection')
const sessionCopy = document.querySelector('#phone-session')
const statusLight = document.querySelector('#phone-status-light')

let socket = null
let retryTimer = 0
let closed = false
let dirty = true

sessionCopy.textContent = session ? `SESSION ${session.match(/.{1,4}/g).join(' · ')}` : 'INVALID LINK'

function setConnection(state, title, copy) {
  connection.dataset.state = state
  connection.querySelector('strong').textContent = title
  connection.querySelector('span').textContent = copy
  statusLight.dataset.state = state
  document.body.dataset.connected = String(state === 'connected')
}

function send(message) {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message))
}

function snapshot() {
  return { axes: [...axes], buttons: buttons.map((button) => ({ ...button })) }
}

function sendSnapshot(force = false) {
  if (!force && !dirty) return
  send({ type: 'snapshot', payload: snapshot() })
  dirty = false
}

function connect() {
  if (!session || !relayUrl) {
    setConnection('error', 'PAIRING LINK INCOMPLETE', 'Return to the computer and scan the new QR code.')
    return
  }
  setConnection('connecting', 'CONNECTING…', 'Keep both devices on the same Wi-Fi network.')
  socket = new WebSocket(relayUrl)
  socket.addEventListener('open', () => {
    send({ type: 'register', role: 'controller', session })
    setConnection('waiting', 'COMPUTER FOUND · PAIRING', 'Keep this page open while the world accepts the controller.')
  })
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(event.data)
      if (message.type === 'status') {
        if (message.connected) {
          setConnection('connected', 'CONNECTED TO UPGRADVERSE', 'Touch controls are live. Rotate to landscape for the best feel.')
          navigator.vibrate?.([45, 35, 70])
          dirty = true
        } else setConnection('waiting', 'WAITING FOR GAME', 'Open upGradVerse on the computer connected to this Wi-Fi.')
      } else if (message.type === 'haptic') {
        const patterns = { tap: 24, success: [45, 28, 75], impact: 80 }
        navigator.vibrate?.(patterns[message.payload?.pattern] || patterns.tap)
      }
    } catch (error) {
      console.warn('[upGradVerse phone] Ignored malformed relay message.', error)
    }
  })
  socket.addEventListener('close', () => {
    setConnection('offline', 'CONNECTION LOST', 'Reconnecting on your local Wi-Fi…')
    if (!closed) retryTimer = window.setTimeout(connect, 1200)
  })
  socket.addEventListener('error', () => socket?.close())
}

function setAxis(index, value) {
  const next = Math.max(-1, Math.min(1, value))
  if (Math.abs(axes[index] - next) < 0.008) return
  axes[index] = next
  dirty = true
}

function attachStick(element) {
  const kind = element.dataset.stick
  const axisOffset = kind === 'move' ? 0 : 2
  const knob = element.querySelector('i')
  let pointerId = null

  const update = (event) => {
    const rect = element.getBoundingClientRect()
    const radius = rect.width * 0.34
    const rawX = event.clientX - (rect.left + rect.width / 2)
    const rawY = event.clientY - (rect.top + rect.height / 2)
    const magnitude = Math.hypot(rawX, rawY)
    const scale = magnitude > radius ? radius / magnitude : 1
    const x = rawX * scale
    const y = rawY * scale
    knob.style.transform = `translate3d(${x}px,${y}px,0)`
    setAxis(axisOffset, x / radius)
    setAxis(axisOffset + 1, y / radius)
    sendSnapshot(true)
  }

  const release = () => {
    if (pointerId === null) return
    pointerId = null
    knob.style.transform = 'translate3d(0,0,0)'
    setAxis(axisOffset, 0)
    setAxis(axisOffset + 1, 0)
    sendSnapshot(true)
  }

  element.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId
    element.setPointerCapture(pointerId)
    element.classList.add('is-active')
    update(event)
  })
  element.addEventListener('pointermove', (event) => {
    if (event.pointerId === pointerId) update(event)
  })
  element.addEventListener('pointerup', (event) => {
    if (event.pointerId !== pointerId) return
    element.classList.remove('is-active')
    release()
  })
  element.addEventListener('pointercancel', () => {
    element.classList.remove('is-active')
    release()
  })
}

function setButton(index, pressed) {
  const button = buttons[index]
  if (!button || button.pressed === pressed) return
  button.pressed = pressed
  button.touched = pressed
  button.value = pressed ? 1 : 0
  dirty = true
  if (pressed) {
    send({ type: 'action', payload: { index, value: 1, pressed: true } })
    navigator.vibrate?.(18)
  }
  sendSnapshot(true)
}

document.querySelectorAll('[data-stick]').forEach(attachStick)
document.querySelectorAll('[data-button]').forEach((element) => {
  const index = Number(element.dataset.button)
  let pointerId = null
  element.addEventListener('pointerdown', (event) => {
    pointerId = event.pointerId
    element.setPointerCapture(pointerId)
    element.classList.add('is-pressed')
    setButton(index, true)
  })
  const release = (event) => {
    if (pointerId !== null && event?.pointerId !== undefined && event.pointerId !== pointerId) return
    pointerId = null
    element.classList.remove('is-pressed')
    setButton(index, false)
  }
  element.addEventListener('pointerup', release)
  element.addEventListener('pointercancel', release)
  element.addEventListener('lostpointercapture', release)
})

window.setInterval(() => sendSnapshot(), 32)
window.addEventListener('contextmenu', (event) => event.preventDefault())
window.addEventListener('pagehide', () => {
  closed = true
  window.clearTimeout(retryTimer)
  axes.fill(0)
  buttons.forEach((button) => Object.assign(button, { pressed: false, touched: false, value: 0 }))
  sendSnapshot(true)
  socket?.close()
})

connect()

