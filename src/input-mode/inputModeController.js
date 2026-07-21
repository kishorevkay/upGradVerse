const BUTTON_COUNT = 19

function makeButton() {
  return { pressed: false, touched: false, value: 0 }
}

function clampAxis(value) {
  const number = Number(value) || 0
  return Math.max(-1, Math.min(1, number))
}

function normaliseButton(button = {}) {
  const value = Math.max(0, Math.min(1, Number(button.value) || 0))
  return {
    pressed: Boolean(button.pressed || value > 0.62),
    touched: Boolean(button.touched || button.pressed || value > 0),
    value,
  }
}

function makeVirtualGamepad() {
  return {
    id: 'upGradVerse Phone Controller',
    index: 0,
    connected: true,
    mapping: 'standard',
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: BUTTON_COUNT }, makeButton),
    timestamp: performance.now(),
    vibrationActuator: null,
    hapticActuators: [],
  }
}

class InputModeController extends EventTarget {
  constructor() {
    super()
    this.mode = null
    this.phoneConnected = false
    this.virtualGamepad = makeVirtualGamepad()
    this.virtualGamepadEnabled = false
    this.virtualGamepadInstalled = false
    this.nativeGetGamepads = navigator.getGamepads?.bind(navigator) || (() => [])
    this.lastSnapshot = {
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: BUTTON_COUNT }, makeButton),
      move: { x: 0, y: 0 },
      camera: { x: 0, y: 0 },
    }
    this.installVirtualGamepad()
  }

  installVirtualGamepad() {
    try {
      Object.defineProperty(navigator, 'getGamepads', {
        configurable: true,
        value: () => {
          if (this.virtualGamepadEnabled) return [this.virtualGamepad]
          return this.nativeGetGamepads() || []
        },
      })
      this.virtualGamepadInstalled = true
    } catch (error) {
      console.warn('[upGradVerse input] Virtual gamepad unavailable; use the compatibility bridge.', error)
    }
  }

  setMode(mode) {
    if (!['keyboard', 'gamepad', 'phone'].includes(mode)) {
      throw new Error(`Unsupported input mode: ${mode}`)
    }
    this.mode = mode
    this.virtualGamepadEnabled = mode === 'phone' && this.virtualGamepadInstalled
    this.dispatch('modechange', { mode, virtualGamepad: this.virtualGamepadEnabled })
    window.dispatchEvent(new CustomEvent('upgradverse:input-mode', { detail: this.getState() }))
  }

  setPhoneConnected(connected) {
    this.phoneConnected = Boolean(connected)
    if (!connected) this.releaseAll()
    this.dispatch('connectionchange', { connected: this.phoneConnected })
    window.dispatchEvent(new CustomEvent('upgradverse:phone-connection', { detail: this.getState() }))
  }

  applySnapshot(payload = {}) {
    const axes = [0, 1, 2, 3].map((index) => clampAxis(payload.axes?.[index]))
    const buttons = Array.from({ length: BUTTON_COUNT }, (_, index) => normaliseButton(payload.buttons?.[index]))
    this.virtualGamepad.axes.splice(0, 4, ...axes)
    buttons.forEach((button, index) => Object.assign(this.virtualGamepad.buttons[index], button))
    this.virtualGamepad.timestamp = performance.now()

    this.lastSnapshot = {
      axes,
      buttons,
      move: { x: axes[0], y: axes[1] },
      camera: { x: axes[2], y: axes[3] },
    }
    this.dispatch('snapshot', this.lastSnapshot)
    window.dispatchEvent(new CustomEvent('upgradverse:phone-snapshot', { detail: this.lastSnapshot }))
  }

  applyAction(payload = {}) {
    const action = {
      type: 'button',
      index: Number(payload.index),
      value: Number(payload.value) || 1,
      pressed: payload.pressed !== false,
    }
    this.dispatch('action', action)
    window.dispatchEvent(new CustomEvent('upgradverse:phone-action', { detail: action }))
  }

  releaseAll() {
    this.applySnapshot({
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: BUTTON_COUNT }, makeButton),
    })
  }

  getSnapshot() {
    return this.lastSnapshot
  }

  getState() {
    return {
      mode: this.mode,
      phoneConnected: this.phoneConnected,
      virtualGamepad: this.virtualGamepadEnabled,
    }
  }

  onSnapshot(listener) {
    const handler = (event) => listener(event.detail)
    this.addEventListener('snapshot', handler)
    return () => this.removeEventListener('snapshot', handler)
  }

  onAction(listener) {
    const handler = (event) => listener(event.detail)
    this.addEventListener('action', handler)
    return () => this.removeEventListener('action', handler)
  }

  onConnection(listener) {
    const handler = (event) => listener(event.detail)
    this.addEventListener('connectionchange', handler)
    return () => this.removeEventListener('connectionchange', handler)
  }

  dispatch(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail }))
  }
}

export const inputModeController = new InputModeController()

export function getInputModeController() {
  return inputModeController
}

