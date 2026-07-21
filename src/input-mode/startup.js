import QRCode from 'qrcode'
import { inputModeController } from './inputModeController.js'
import { attachKeyboardCompatibilityBridge } from './keyboardCompatibilityBridge.js'
import { PhoneRelayClient } from './relayClient.js'
import './startup.css'

const RELAY_PORT = 8051
const SESSION_KEY = 'upgradverse-phone-session'

function createSessionId() {
  const bytes = crypto.getRandomValues(new Uint8Array(7))
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
}

function getSessionId() {
  let session = sessionStorage.getItem(SESSION_KEY)
  if (!session) {
    session = createSessionId()
    sessionStorage.setItem(SESSION_KEY, session)
  }
  return session
}

function makeRelayUrl(hostname) {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${hostname}:${RELAY_PORT}`
}

async function resolveLanHost() {
  if (!['localhost', '127.0.0.1', '::1'].includes(location.hostname)) return location.hostname
  try {
    const response = await fetch(`http://${location.hostname}:${RELAY_PORT}/network-info`, { signal: AbortSignal.timeout(1800) })
    if (!response.ok) throw new Error('Relay did not return network details.')
    const payload = await response.json()
    return payload.addresses?.[0] || location.hostname
  } catch {
    return location.hostname
  }
}

const root = document.createElement('section')
root.className = 'uv-input-startup'
root.id = 'uv-input-startup'
root.setAttribute('aria-hidden', 'true')
root.innerHTML = `
  <div class="uv-input-aurora uv-input-aurora-a"></div>
  <div class="uv-input-aurora uv-input-aurora-b"></div>
  <div class="uv-input-glass" role="dialog" aria-modal="true" aria-labelledby="uv-input-title">
    <button class="uv-input-close" type="button" aria-label="Close input selector">×</button>
    <div class="uv-input-heading">
      <span>UPGRADVERSE / INPUT LINK</span>
      <h2 id="uv-input-title">How do you want to play?</h2>
      <p>Choose the control setup that feels natural to you.</p>
    </div>
    <div class="uv-input-options">
      <button class="uv-input-option" type="button" data-mode="keyboard">
        <i class="uv-input-icon">⌨</i>
        <span><strong>Keyboard + mouse</strong><small>WASD movement · mouse camera</small></span>
        <b>READY</b>
      </button>
      <button class="uv-input-option" type="button" data-mode="gamepad">
        <i class="uv-input-icon">⌁</i>
        <span><strong>Gamepad</strong><small>DualSense or standard controller</small></span>
        <b>AUTO</b>
      </button>
      <button class="uv-input-option uv-phone-option" type="button" data-mode="phone">
        <i class="uv-input-icon">▯</i>
        <span><strong>Use your phone</strong><small>Scan once · touch gamepad opens instantly</small></span>
        <b>QR</b>
      </button>
    </div>
    <div class="uv-pairing" aria-hidden="true">
      <div class="uv-pairing-qr"><canvas width="220" height="220" aria-label="Phone controller pairing QR code"></canvas><i></i></div>
      <div class="uv-pairing-copy">
        <span class="uv-pairing-kicker">PHONE CONTROLLER</span>
        <h3>Scan to connect</h3>
        <p>Connect this computer and your phone to the <strong>same Wi-Fi network</strong>, then scan the QR code.</p>
        <div class="uv-pairing-status" role="status"><i></i><span>STARTING LOCAL LINK…</span></div>
        <small class="uv-pairing-code">SESSION <b>—</b></small>
        <button class="uv-phone-enter" type="button" disabled>WAITING FOR PHONE</button>
        <button class="uv-pairing-back" type="button">← CHOOSE ANOTHER INPUT</button>
      </div>
    </div>
    <footer><i></i><span>Local pairing only. Controller input stays on your Wi-Fi.</span></footer>
  </div>
`
document.body.append(root)

const enterButton = document.querySelector('#enter-world')
const closeButton = root.querySelector('.uv-input-close')
const pairing = root.querySelector('.uv-pairing')
const pairingStatus = root.querySelector('.uv-pairing-status')
const pairingStatusCopy = pairingStatus.querySelector('span')
const pairingCode = root.querySelector('.uv-pairing-code b')
const phoneEnter = root.querySelector('.uv-phone-enter')
const qrCanvas = root.querySelector('canvas')

let allowWorldEntry = false
let relay = null
let pairingUrl = null
let selectorOpen = false
let keyboardBridgeCleanup = () => {}

function updateWorldControllerPill(copy, connected = false) {
  const pill = document.querySelector('#controller-state')
  if (!pill) return
  pill.classList.toggle('is-connected', connected)
  const label = pill.querySelector('span')
  if (label) label.textContent = copy
}

function setPairingStatus(state, copy) {
  pairingStatus.dataset.state = state
  pairingStatusCopy.textContent = copy
}

function showSelector() {
  selectorOpen = true
  root.classList.add('is-visible')
  root.setAttribute('aria-hidden', 'false')
  pairing.classList.remove('is-visible')
  pairing.setAttribute('aria-hidden', 'true')
  root.querySelector('.uv-input-options').classList.remove('is-hidden')
  root.querySelector('.uv-input-heading').classList.remove('is-hidden')
  closeButton.focus({ preventScroll: true })
}

function hideSelector() {
  selectorOpen = false
  root.classList.remove('is-visible')
  root.setAttribute('aria-hidden', 'true')
}

function enterWorld(mode) {
  inputModeController.setMode(mode)
  hideSelector()
  allowWorldEntry = true
  queueMicrotask(() => enterButton?.click())
}

function stopPhoneRelay() {
  relay?.close()
  relay = null
  inputModeController.setPhoneConnected(false)
}

async function openPhonePairing() {
  inputModeController.setMode('phone')
  pairing.classList.add('is-visible')
  pairing.setAttribute('aria-hidden', 'false')
  root.querySelector('.uv-input-options').classList.add('is-hidden')
  root.querySelector('.uv-input-heading').classList.add('is-hidden')
  phoneEnter.disabled = true
  phoneEnter.textContent = 'WAITING FOR PHONE'
  setPairingStatus('connecting', 'STARTING LOCAL LINK…')

  const session = getSessionId()
  const lanHost = await resolveLanHost()
  const relayUrl = makeRelayUrl(lanHost)
  const controllerPort = location.port || '8050'
  pairingUrl = `${location.protocol}//${lanHost}:${controllerPort}/controller.html?session=${encodeURIComponent(session)}&relay=${encodeURIComponent(relayUrl)}`
  pairingCode.textContent = session.match(/.{1,4}/g).join(' · ')

  await QRCode.toCanvas(qrCanvas, pairingUrl, {
    width: 220,
    margin: 1,
    errorCorrectionLevel: 'M',
    color: { dark: '#111014', light: '#f7f4f4' },
  })

  stopPhoneRelay()
  inputModeController.setMode('phone')
  relay = new PhoneRelayClient({ session, relayUrl: makeRelayUrl(location.hostname) })
  relay.addEventListener('snapshot', (event) => inputModeController.applySnapshot(event.detail))
  relay.addEventListener('action', (event) => inputModeController.applyAction(event.detail))
  relay.addEventListener('status', (event) => {
    const { state, connected } = event.detail
    inputModeController.setPhoneConnected(connected)
    if (connected) {
      setPairingStatus('connected', 'PHONE CONNECTED')
      phoneEnter.disabled = false
      phoneEnter.textContent = 'ENTER WITH PHONE'
      updateWorldControllerPill('PHONE CONTROLLER', true)
      relay.sendHaptic('success')
    } else if (state === 'offline') {
      setPairingStatus('offline', 'LOCAL RELAY OFFLINE · RUN NPM RUN DEV')
      phoneEnter.disabled = true
      phoneEnter.textContent = 'WAITING FOR RELAY'
    } else {
      setPairingStatus('waiting', 'WAITING FOR PHONE…')
    }
  })
  relay.connect()
}

root.querySelectorAll('[data-mode]').forEach((button) => {
  button.addEventListener('click', () => {
    const mode = button.dataset.mode
    if (mode === 'phone') openPhonePairing().catch((error) => {
      console.error('[upGradVerse input] Phone pairing failed.', error)
      setPairingStatus('offline', 'COULD NOT CREATE PHONE LINK')
    })
    else {
      stopPhoneRelay()
      updateWorldControllerPill(mode === 'gamepad' ? 'GAMEPAD READY' : 'KEYBOARD READY', mode === 'gamepad')
      enterWorld(mode)
    }
  })
})

root.querySelector('.uv-pairing-back').addEventListener('click', () => {
  stopPhoneRelay()
  showSelector()
})
phoneEnter.addEventListener('click', () => enterWorld('phone'))
closeButton.addEventListener('click', hideSelector)

enterButton?.addEventListener('click', (event) => {
  if (allowWorldEntry) {
    allowWorldEntry = false
    return
  }
  event.preventDefault()
  event.stopImmediatePropagation()
  showSelector()
}, true)

window.addEventListener('keydown', (event) => {
  if (!selectorOpen) return
  if (event.code === 'Escape') {
    event.preventDefault()
    hideSelector()
  }
}, true)

keyboardBridgeCleanup = attachKeyboardCompatibilityBridge(inputModeController)

window.upGradVerseInput = Object.freeze({
  controller: inputModeController,
  showStartup: showSelector,
  hideStartup: hideSelector,
  getState: () => inputModeController.getState(),
  getSnapshot: () => inputModeController.getSnapshot(),
  getPairingUrl: () => pairingUrl,
  sendPhoneHaptic: (pattern) => relay?.sendHaptic(pattern),
})

window.addEventListener('beforeunload', () => {
  keyboardBridgeCleanup()
  stopPhoneRelay()
})
