# upGradVerse

upGradVerse is a browser-based 3D learning world where practical AI skills become places, missions and playable simulations. Players explore a living cyber-city, enter Skill Shops, complete visual challenges, drive vehicles, and use either keyboard and mouse, a standard gamepad, or a phone as a same-Wi-Fi controller.

Built for the OpenAI Build Week Education track.

## Playable experiences

- Open 3D city with third-person traversal and a GTA-inspired camera.
- ChatGPT Skill Shop: model choice, context packaging and code-repair missions.
- Claude Skill Shop: visual reasoning and artifact-building missions.
- Human Instincts district connection.
- Verse Fight Ring: an original human-versus-machine combat simulation.
- Drivable cars and motorcycles, city traffic, flying vehicles and elevated metro.
- DualSense controls and rumble.
- QR phone controller with two sticks, triggers and action buttons.

## Run locally

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:8050/`.

For the phone controller, connect the computer and phone to the same Wi-Fi network, choose **Use your phone** on the opening screen, and scan the QR code. The local relay runs on port `8051`.

## Controls

- `WASD` / left stick: move or steer
- Mouse / right stick: orbit camera
- `Shift` / `R2`: sprint or accelerate
- `Space` / Cross: jump
- `E` / Triangle: interact, enter or exit vehicle
- Square: handbrake and drift
- `R3` / `V`: cycle vehicle camera
- `P` / Options: pause

Inside the Verse Fight Ring:

- `WASD` / left stick: move around the octagon
- `J` / Cross: jab
- `H` / Square: hook
- `U` / L1: uppercut
- `K` / Triangle: kick
- `C` / Circle: dodge
- `Space` / R2: jump strike
- `Esc` / Options: return to the city

## How Codex was used

Codex was the production partner throughout the Build Week extension. It inspected and preserved the approved world scale, camera and DualSense feel; implemented driving physics and vehicle camera modes; integrated licensed GLB assets; built the two AI Skill Shops; created the multi-input and phone-controller system; added the city atmosphere, metro and aerial traffic; and built the combat simulation. Codex also ran production builds, local browser QA, performance checks, asset-attribution checks and prepared the submission package.

Kish directed the product concept, learning model, interaction feel, visual taste and iterative play-test feedback. Codex translated those decisions into the working implementation.

## Pre-existing work versus Build Week work

Before the submission period, the concept existed as an AtlasVerse/upGradVerse grey-box with an approved third-person character, central upGrad building, basic camera and DualSense traversal. During the Build Week submission period it was meaningfully extended into a coherent playable product: two complete AI Skill Shops, multiple visual mini-games, vehicle acquisition and driving, bikes, phone controls, original soundtrack integration, city traffic and ambience, expanded world navigation, fight arena, licensed environment and vehicle assets, performance work, submission documentation and a deployable build.

## Build and test

```bash
npm run build
```

The current target is a desktop browser with WebGL. Keyboard and standard gamepads work in a hosted build. The QR phone controller additionally requires the local relay and same-Wi-Fi access.

## Third-party assets

Attribution and source notes are stored beside the assets:

- `public/assets/buildings/third-party/ATTRIBUTION.md`
- `public/assets/vehicles/third-party/ATTRIBUTION.md`
- `public/assets/characters/third-party/ATTRIBUTION.md`
- `public/assets/audio/ATTRIBUTION.md`

All third-party material must remain under its stated license. upGrad branding and original project code remain the property of their respective owners.
