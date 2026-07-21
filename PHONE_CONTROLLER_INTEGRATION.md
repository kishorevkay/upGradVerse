# upGradVerse input-mode and phone controller

## Local run

```bash
npm run dev
```

This starts:

- the Vite world server on port `8050`, bound to the local network;
- the local WebSocket controller relay on port `8051`.

The computer and phone must be on the same Wi-Fi. macOS may ask once for permission to accept local network connections. Open the world, select **Use your phone**, then scan the locally generated QR code.

## Existing-world compatibility

No changes are required in `src/world/main.js`.

`src/input-mode/startup.js` loads before the world module and installs a standards-shaped virtual gamepad. In phone mode, the existing `GamepadAdapter` reads the phone's axes and buttons through `navigator.getGamepads()`, so the current control path remains the authority.

Current phone mapping:

| Phone control | Standard gamepad index | Existing world action |
| --- | ---: | --- |
| Left touch stick | Axes 0–1 | Move / steer |
| Right touch stick | Axes 2–3 | Orbit camera |
| Cross | 0 | Jump / confirm |
| Circle | 1 | Back |
| Square | 2 | Handbrake / drift |
| Triangle | 3 | Interact / enter / exit |
| L2 | 6 | Brake / reverse |
| R2 | 7 | Sprint / accelerate |
| Options | 9 | Pause |
| R3 | 11 | Cycle vehicle camera / recenter |

If a browser refuses the virtual-gamepad override, `keyboardCompatibilityBridge.js` provides a reduced keyboard-event fallback.

## Module API for explicit parent integration

```js
import { inputModeController } from './src/input-mode/inputModeController.js'

const stopSnapshot = inputModeController.onSnapshot((snapshot) => {
  // snapshot.axes: [moveX, moveY, cameraX, cameraY]
  // snapshot.move: { x, y }
  // snapshot.camera: { x, y }
  // snapshot.buttons: standard GamepadButton-shaped objects
})

const stopAction = inputModeController.onAction((action) => {
  // action: { type: 'button', index, value, pressed }
})

const stopConnection = inputModeController.onConnection(({ connected }) => {
  // phone peer status
})

inputModeController.getSnapshot()
inputModeController.getState()

// Each subscription returns its unsubscribe function.
stopSnapshot()
stopAction()
stopConnection()
```

The startup layer also exposes a small browser API:

```js
window.upGradVerseInput.showStartup()
window.upGradVerseInput.hideStartup()
window.upGradVerseInput.getState()
window.upGradVerseInput.getSnapshot()
window.upGradVerseInput.getPairingUrl()
window.upGradVerseInput.sendPhoneHaptic('tap') // tap | success | impact
```

Equivalent window events are emitted for non-module consumers:

- `upgradverse:input-mode`
- `upgradverse:phone-connection`
- `upgradverse:phone-snapshot`
- `upgradverse:phone-action`

## Relay protocol

The relay keeps no database and forwards only live controller state inside an in-memory random session. It supports one host and one phone controller per session. Closing either page removes that peer.

For a hosted production build, replace the local relay URL with a deployed secure WebSocket endpoint (`wss://`). A static-only Vercel deployment cannot keep this persistent relay process alive by itself.

