const BUTTON_KEYS = new Map([
  [0, 'Space'],
  [1, 'Escape'],
  [2, 'Space'],
  [3, 'KeyE'],
  [7, 'ShiftLeft'],
  [9, 'KeyP'],
  [11, 'KeyV'],
])

function emit(code, type) {
  window.dispatchEvent(new KeyboardEvent(type, { code, bubbles: true, cancelable: true }))
}

export function attachKeyboardCompatibilityBridge(controller) {
  if (controller.virtualGamepadInstalled) return () => {}

  let activeKeys = new Set()
  let cameraTimer = 0

  const stopSnapshot = controller.onSnapshot((snapshot) => {
    const next = new Set()
    if (snapshot.move.y < -0.28) next.add('KeyW')
    if (snapshot.move.y > 0.28) next.add('KeyS')
    if (snapshot.move.x < -0.28) next.add('KeyA')
    if (snapshot.move.x > 0.28) next.add('KeyD')

    snapshot.buttons.forEach((button, index) => {
      if (button.pressed && BUTTON_KEYS.has(index)) next.add(BUTTON_KEYS.get(index))
    })

    next.forEach((code) => {
      if (!activeKeys.has(code)) emit(code, 'keydown')
    })
    activeKeys.forEach((code) => {
      if (!next.has(code)) emit(code, 'keyup')
    })
    activeKeys = next
  })

  cameraTimer = window.setInterval(() => {
    const { camera } = controller.getSnapshot()
    if (camera.x < -0.28) emit('KeyJ', 'keydown')
    if (camera.x > 0.28) emit('KeyL', 'keydown')
    if (camera.y < -0.28) emit('KeyI', 'keydown')
    if (camera.y > 0.28) emit('KeyK', 'keydown')
  }, 70)

  return () => {
    stopSnapshot()
    window.clearInterval(cameraTimer)
    activeKeys.forEach((code) => emit(code, 'keyup'))
    activeKeys.clear()
  }
}

