import './controller.css'

const params = new URLSearchParams(location.search)
const session = params.get('session') || ''
const relayUrl = params.get('relay') || ''
const BUTTON_COUNT = 19
const SEND_INTERVAL_MS = 32

const axes = [0, 0, 0, 0]
const rawStickAxes = [0, 0, 0, 0]
const buttons = Array.from({ length: BUTTON_COUNT }, () => ({ pressed: false, touched: false, value: 0 }))
const dpadState = { up: false, down: false, left: false, right: false }

const connection = document.querySelector('#phone-connection')
const sessionCopy = document.querySelector('#phone-session')
const statusLight = document.querySelector('#phone-status-light')
const statusCopy = document.querySelector('#phone-status-copy')
const rotateAction = document.querySelector('#rotate-action')
const hapticState = document.querySelector('#haptic-state')

let socket = null
let retryTimer = 0
let closed = false
let dirty = true

sessionCopy.textContent = session ? `SESSION ${session.match(/.{1,4}/g).join(' · ')}` : 'INVALID LINK'
hapticState.textContent = typeof navigator.vibrate === 'function' ? 'READY' : 'DEVICE LIMITED'

function vibrate(pattern = 16) {
  try { return Boolean(navigator.vibrate?.(pattern)) } catch { return false }
}

function setConnection(state, title, copy) {
  connection.dataset.state = state
  connection.querySelector('strong').textContent = title
  connection.querySelector('span').textContent = copy
  statusLight.dataset.state = state
  statusCopy.textContent = state === 'connected' ? 'LIVE' : state === 'offline' ? 'OFFLINE' : state === 'error' ? 'ERROR' : 'LINKING'
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
  if (closed) return
  if (!session || !relayUrl) {
    setConnection('error', 'PAIRING LINK INCOMPLETE', 'Return to the computer and scan a fresh QR code.')
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
          setConnection('connected', 'CONNECTED TO UPGRADVERSE', 'Controls are live. Landscape mode gives the full gamepad.')
          vibrate([35, 28, 70])
          dirty = true
          sendSnapshot(true)
        } else {
          setConnection('waiting', 'WAITING FOR GAME', 'Open upGradVerse on the computer connected to this Wi-Fi.')
        }
      } else if (message.type === 'haptic') {
        const patterns = {
          tap: 18,
          success: [38, 24, 68],
          impact: [62, 18, 28],
          drift: [22, 18, 22, 18, 36],
          warning: [75, 35, 75],
        }
        vibrate(patterns[message.payload?.pattern] || patterns.tap)
      }
    } catch (error) {
      console.warn('[upGradVerse phone] Ignored malformed relay message.', error)
    }
  })
  socket.addEventListener('close', () => {
    releaseAllInputs(false)
    setConnection('offline', 'CONNECTION LOST', 'Reconnecting on your local Wi-Fi…')
    if (!closed) retryTimer = window.setTimeout(connect, 1200)
  })
  socket.addEventListener('error', () => socket?.close())
}

function setAxis(index, value) {
  const next = Math.max(-1, Math.min(1, Number(value) || 0))
  if (Math.abs(axes[index] - next) < 0.006) return
  axes[index] = next
  dirty = true
}

function composeMoveAxes() {
  const dpadX = Number(dpadState.right) - Number(dpadState.left)
  const dpadY = Number(dpadState.down) - Number(dpadState.up)
  setAxis(0, Math.abs(rawStickAxes[0]) > 0.08 ? rawStickAxes[0] : dpadX)
  setAxis(1, Math.abs(rawStickAxes[1]) > 0.08 ? rawStickAxes[1] : dpadY)
}

function attachStick(element) {
  const kind = element.dataset.stick
  const axisOffset = kind === 'move' ? 0 : 2
  const knob = element.querySelector('i')
  let pointerId = null

  const update = (event) => {
    const rect = element.getBoundingClientRect()
    const radius = Math.max(1, rect.width * 0.34)
    const rawX = event.clientX - (rect.left + rect.width / 2)
    const rawY = event.clientY - (rect.top + rect.height / 2)
    const magnitude = Math.hypot(rawX, rawY)
    const scale = magnitude > radius ? radius / magnitude : 1
    const x = rawX * scale
    const y = rawY * scale
    knob.style.transform = `translate3d(${x}px,${y}px,0)`
    rawStickAxes[axisOffset] = x / radius
    rawStickAxes[axisOffset + 1] = y / radius
    if (axisOffset === 0) composeMoveAxes()
    else {
      setAxis(2, rawStickAxes[2])
      setAxis(3, rawStickAxes[3])
    }
    sendSnapshot(true)
  }

  const release = () => {
    if (pointerId === null) return
    pointerId = null
    element.classList.remove('is-active')
    knob.style.transform = 'translate3d(0,0,0)'
    rawStickAxes[axisOffset] = 0
    rawStickAxes[axisOffset + 1] = 0
    if (axisOffset === 0) composeMoveAxes()
    else {
      setAxis(2, 0)
      setAxis(3, 0)
    }
    sendSnapshot(true)
  }

  element.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    if (pointerId !== null) release()
    pointerId = event.pointerId
    element.setPointerCapture?.(pointerId)
    element.classList.add('is-active')
    vibrate(9)
    update(event)
  })
  element.addEventListener('pointermove', (event) => {
    if (event.pointerId !== pointerId) return
    event.preventDefault()
    update(event)
  })
  element.addEventListener('pointerup', (event) => {
    if (event.pointerId === pointerId) release()
  })
  element.addEventListener('pointercancel', release)
  element.addEventListener('lostpointercapture', release)
}

function setButton(index, pressed, { action = true, feedback = true } = {}) {
  const button = buttons[index]
  if (!button || button.pressed === pressed) return
  button.pressed = pressed
  button.touched = pressed
  button.value = pressed ? 1 : 0
  dirty = true
  if (pressed) {
    if (action) send({ type: 'action', payload: { index, value: 1, pressed: true } })
    if (feedback) vibrate(index === 7 || index === 2 ? 24 : 14)
  }
}

function attachButton(element, onChange) {
  const index = Number(element.dataset.button)
  let pointerId = null

  const release = (event) => {
    if (pointerId === null) return
    if (event?.pointerId !== undefined && event.pointerId !== pointerId) return
    pointerId = null
    element.classList.remove('is-pressed')
    setButton(index, false, { feedback: false })
    onChange?.(false)
    sendSnapshot(true)
  }

  element.addEventListener('pointerdown', (event) => {
    event.preventDefault()
    if (pointerId !== null) release()
    pointerId = event.pointerId
    element.setPointerCapture?.(pointerId)
    element.classList.add('is-pressed')
    setButton(index, true)
    onChange?.(true)
    sendSnapshot(true)
  })
  element.addEventListener('pointerup', release)
  element.addEventListener('pointercancel', release)
  element.addEventListener('lostpointercapture', release)
}

document.querySelectorAll('[data-stick]').forEach(attachStick)
document.querySelectorAll('[data-button]:not([data-direction])').forEach((element) => attachButton(element))
document.querySelectorAll('[data-direction]').forEach((element) => {
  const direction = element.dataset.direction
  attachButton(element, (pressed) => {
    dpadState[direction] = pressed
    composeMoveAxes()
  })
})

document.querySelectorAll('[data-control-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.controlMode
    document.body.dataset.controlMode = mode
    document.querySelectorAll('[data-control-mode]').forEach((candidate) => candidate.classList.toggle('is-active', candidate === button))
    document.querySelectorAll('[data-world-label]').forEach((label) => {
      label.textContent = mode === 'fight' ? label.dataset.fightLabel : label.dataset.worldLabel
    })
    vibrate([12, 20, 18])
  })
})

async function requestLandscape() {
  vibrate(18)
  try {
    if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' })
    }
  } catch {
    // Fullscreen may be unavailable on iOS; the rotate overlay remains as guidance.
  }
  try { await screen.orientation?.lock?.('landscape') } catch {
    // Orientation locking is best-effort and requires browser/OS support.
  }
}

rotateAction.addEventListener('click', requestLandscape)

function releaseAllInputs(shouldSend = true) {
  rawStickAxes.fill(0)
  axes.fill(0)
  Object.keys(dpadState).forEach((key) => { dpadState[key] = false })
  buttons.forEach((button) => Object.assign(button, { pressed: false, touched: false, value: 0 }))
  document.querySelectorAll('.is-pressed,[data-stick].is-active').forEach((element) => element.classList.remove('is-pressed', 'is-active'))
  document.querySelectorAll('[data-stick] > i').forEach((knob) => { knob.style.transform = 'translate3d(0,0,0)' })
  dirty = true
  if (shouldSend) sendSnapshot(true)
}

window.setInterval(() => sendSnapshot(), SEND_INTERVAL_MS)
window.addEventListener('contextmenu', (event) => event.preventDefault())
window.addEventListener('blur', () => releaseAllInputs())
window.addEventListener('orientationchange', () => releaseAllInputs())
document.addEventListener('visibilitychange', () => {
  if (document.hidden) releaseAllInputs()
})
window.addEventListener('pagehide', () => {
  releaseAllInputs(true)
  closed = true
  window.clearTimeout(retryTimer)
  socket?.close()
})

connect()
