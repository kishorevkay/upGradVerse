# upGradVerse Submission Asset Checklist

Project root: `/Users/kishorekumar/upGradVerse`

## Confirmed in the current build

- [x] Main browser entry: `index.html`
- [x] Phone controller entry: `controller.html`
- [x] Three.js world and gameplay: `src/world/main.js`
- [x] City/asset enhancement layer: `src/world/cityUpgrade.js`
- [x] Transport enhancement layer: `src/world/transportUpgrade.js`
- [x] Procedural world audio: `src/world/audioDirector.js`
- [x] ChatGPT Skill Shop: `src/skillshop/skillshop.js`
- [x] Claude Artifact Studio: `src/claude-shop/claudeShop.js`
- [x] In-world 3D fight simulation: `src/arena3d/arena3d.js`
- [x] Input-mode selector and QR flow: `src/input-mode/startup.js`
- [x] Local phone relay: `server/controller-relay.mjs`
- [x] Combined local launcher: `server/dev.mjs`
- [x] Production build succeeds. Final validation on `2026-07-22 IST`: 104 modules transformed; build completed with a non-blocking large-chunk warning.

## Current visual and 3D assets

- [x] upGrad logo: `public/assets/upgrad-logo.png`
- [x] Main animated character: `public/assets/characters/kish_3d_avatar.glb`
- [x] Central upGrad building: `public/assets/buildings/upgrad_building.glb`
- [x] Rigged robot citizen: `public/assets/characters/third-party/RobotExpressive.glb`
- [x] City building set: `public/assets/buildings/third-party/kenney-city/`
- [x] Car models: `public/assets/vehicles/third-party/sports-car-a.glb`, `sports-car-b.glb`, and `suv.glb`
- [x] Bike model: `public/assets/vehicles/third-party/suzuki-sv650.glb`
- [x] Licensed in-world punk track: `public/assets/audio/everything-i-hate-punk-vocal.mp3`
- [x] Audio attribution: `public/assets/audio/ATTRIBUTION.md`
- [x] Building attribution: `public/assets/buildings/third-party/ATTRIBUTION.md`
- [x] Vehicle attribution: `public/assets/vehicles/third-party/ATTRIBUTION.md`
- [x] Character attribution: `public/assets/characters/third-party/ATTRIBUTION.md`
- [x] Character source image: `Character Concepts/KISH-01-Tripo-Source-v1.png`
- [x] Building concept images: `Building Concepts/UPGRAD-TOWER-01-Tripo-Source-v1.png`, `v2.png`, `v3.png`
- [x] Vehicle concept images: `Vehicle Concepts/01-audi-r8-graphite-red-reference.png` through `04-original-silver-urban-ev-reference.png`

## Screenshots still needed

Save final captures under `submission/screenshots/`.

- [ ] `01-cover-16x9.png` — clean world hero with character, upGrad building, and city depth.
- [ ] `02-input-selector.png` — liquid-glass keyboard/gamepad/phone choice.
- [ ] `03-world-gameplay.png` — third-person traversal with HUD and destination marker.
- [ ] `04-driving.png` — real car model in motion with vehicle HUD, metro/flying traffic visible if composition allows.
- [ ] `05-chatgpt-skillshop.png` — strongest visual routing or repair moment.
- [ ] `06-claude-studio.png` — strongest evidence or artifact moment.
- [ ] `07-phone-controller.png` — desktop plus phone controls; do not publish a live reusable pairing session.
- [ ] `08-skillshop-map.png` — navigation panel with multiple destinations.
- [ ] `09-fight-ring-world.png` — physical ring and 3D human-versus-machine combat HUD.
- [ ] Optional `10-build-process.png` — concept image, model, code, and playable result in one frame.

## Video and audio still needed

Save final media under `submission/video/` and `submission/audio/`.

- [ ] `upgradverse-demo-final.mp4` — maximum three minutes, 1080p60.
- [ ] `upgradverse-demo-60s.mp4` — fallback proof cut.
- [ ] Fresh 60 fps world traversal capture, including a clean metro/flying-traffic reveal.
- [ ] Fresh Skill Shop captures for ChatGPT and Claude.
- [ ] Phone/controller interaction insert.
- [x] A pop-punk vocal track is present and attributed in `public/assets/audio/ATTRIBUTION.md` under the Pixabay Content License.
- [x] The track page identifies the song as free for use under the Pixabay Content License; the source and creator record is preserved beside the asset.
- [ ] Final audio mix with voice, music, engine, UI, and ambience at intelligible levels.
- [ ] Captions burned in or delivered as `upgradverse-demo.en.srt`.

## Safe retained process footage

- [x] Screenpipe local index inspected without copying private text.
- [x] Safe AtlasVerse predecessor window: `2026-07-19 03:23:14–03:25:45 IST`.
- [x] Safe AtlasVerse predecessor window: `2026-07-20 14:57:43–15:04:08 IST`.
- [ ] Export and manually review only if a making-of insert is useful. Commands are in `submission/DEMO_VIDEO_PLAN.md`.
- [ ] Do not use retained Screenpipe clips as hero gameplay; they are `1280 × 830` and sparsely captured.

## Submission documents still needed from the platform

- [x] Official deadline verified: `July 21, 2026 at 5:00 PM PDT`, equivalent to `July 22, 2026 at 5:30 AM IST`.
- [x] Official rules checked: a public YouTube demo under three minutes, working project URL, repository access, README/Codex build story, and Codex `/feedback` Session ID are required.
- [x] Production project URL deployed and smoke-tested: `https://upgradverse.vercel.app`.
- [ ] Add team/company identity exactly as approved for the submission.
- [ ] Add repository link only if the source is intentionally public and has been checked for secrets/licensing.
- [ ] Add third-party asset credits wherever the submission form or final README requires them.

## Truth and quality gates before recording

- [x] Verse Fight Ring is now an in-world 3D human-versus-machine match with movement, six attacks, AI, health, score, timer, crowd, SFX, commentary, and gamepad/keyboard input.
- [x] Source integration mounts a cloned, posed hero on the driven bike through `src/world/transportUpgrade.js`; mounted state was visually smoke-tested.
- [x] Six animated flying cars and an elevated looping cyber metro are integrated through `src/world/transportUpgrade.js`; the production world build and runtime passed.
- [ ] Human Instincts is represented as a reserved district/entrance in this fork; it is not a playable integrated Skill Shop here.
- [x] The world now loads the attributed pop-punk vocal track; Web Audio remains responsible for ambience, engine, and interaction feedback.
- [ ] The phone controller works through a local same-Wi-Fi WebSocket relay. A static deployment alone cannot host the persistent relay.
- [ ] The executable does not currently call the OpenAI API. Describe Codex as the build collaborator and the ChatGPT Skill Shop as a simulation.
- [ ] Replace prototype model labels or clearly state they are teaching abstractions; do not present them as released OpenAI model names.
- [ ] Test desktop keyboard, physical gamepad, phone controller, world traversal, car driving, both Skill Shops, reset/replay, audio mute, and pause on the final build.
- [ ] Check the final recording for notifications, personal tabs, QR/session data, private messages, browser chrome, dropped frames, and audio clipping.
