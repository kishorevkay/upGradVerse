# upGradVerse Demo Video Plan

## Delivery target

- Maximum duration: `03:00`
- Recommended final duration: `02:50–02:55`
- Master: `1920 × 1080`, 60 fps, H.264 MP4, stereo audio
- Capture the current build fresh at 60 fps. Use retained Screenpipe material only as a brief making-of texture because its source capture is sparse.
- Music: use an original or properly licensed punk-rock track. Do not use GTA radio music or any commercial song without explicit submission rights.

## Story spine

**AI learning should feel like entering a world, not opening another course page.** The film must prove the world, the controls, the two playable Skill Shops, and the human-plus-Codex build process.

## Timecoded edit

| Time | Picture | Audio / copy | Required source |
| --- | --- | --- | --- |
| `00:00–00:07` | Cold open: character running through the city, fast cut to a car passing the upGrad building. End on the title. | Punk-rock opening hit. Super: **UPGRADVERSE** / **A PLAYABLE WORLD FOR AI SKILLS** | Fresh 60 fps gameplay |
| `00:07–00:20` | Rapid contrast: conventional course-page language collapses into the 3D city map. | VO: “AI skills change every week. Static courses cannot keep up. So we turned learning into a world.” | Motion graphic + fresh world shot |
| `00:20–00:34` | Liquid-glass input selector. Show keyboard, controller, then the QR phone option and a phone controlling the avatar. | Super: **PLAY YOUR WAY**. Small line: **Keyboard · Gamepad · Phone** | Fresh desktop capture + phone camera insert |
| `00:34–01:00` | Third-person traversal: walk, sprint, jump, orbit camera, approach the upGrad building, enter a real car, cycle camera, and drive under the flying traffic/metro. Include one short mounted-bike shot only after visual QA. | Let engine, UI, and haptic moments breathe. VO: “One identity. One explorable world. Skills become destinations.” | Fresh 60 fps gameplay |
| `01:00–01:32` | Enter the ChatGPT Skill Shop. Show one model-routing choice, one context choice, and the patch-plus-retest payoff. Land on the score. | VO: “The first lab teaches model judgment, useful context, and the repair-test-ship loop through decisions, not lectures.” | Fresh Skill Shop capture |
| `01:32–02:00` | Enter Claude Artifact Studio. Show source cards combining, evidence selection, final verification, and the craft score. | VO: “A second studio turns scattered sources into a clear, evidence-grounded artifact.” | Fresh Skill Shop capture |
| `02:00–02:14` | Return to the world, enter the physical Verse Fight Ring, and land one clean combo in the live 3D human-versus-machine match. | Super: **HUMAN INSTINCT, MADE PLAYABLE** | Fresh gameplay |
| `02:14–02:34` | Build montage: concept frames, GLB character/building, controller testing, code/build terminal, Screenpipe timelapse fragments. | VO: “Built through a rapid loop between human direction, Codex execution, real assets, and hands-on playtesting.” | Current concept images + safe Screenpipe exports + fresh terminal shot |
| `02:34–02:48` | Future map animation: new Skill Shops light up; silhouettes imply multiplayer and creator-built shops. Keep this clearly labeled as vision. | Super: **NEXT: LIVE AI MISSIONS · CREATOR SHOPS · MULTIPLAYER** | Simple motion graphic |
| `02:48–02:55` | Hero skyline shot, character facing the city, upGradVerse lockup. | VO: “Do not just learn AI. Enter the world and practise it.” Music resolves. | Fresh hero capture |

## Retained Screenpipe evidence

Screenpipe is currently stopped. Its local index reports the last captured frame at `2026-07-20 17:06 IST`; it therefore contains no July 21–22 upGradVerse footage. The best retained footage is from the AtlasVerse predecessor and is useful only as honest build-process evidence.

The following two ranges contain only the Brave game window in the retained frame index. They were identified without copying raw screen text or private-app content:

1. `2026-07-19 03:23:14–03:25:45 IST` (`2026-07-18T21:53:14Z–21:55:45Z`)
2. `2026-07-20 14:57:43–15:04:08 IST` (`2026-07-20T09:27:43Z–09:34:08Z`)

Safe local exports; review each MP4 before editing or sharing:

```bash
screenpipe export \
  --start 2026-07-18T21:53:14Z \
  --end 2026-07-18T21:55:45Z \
  --output "/Users/kishorekumar/upGradVerse/submission/screenpipe-atlasverse-test-2026-07-19-032314-ist.mp4"
```

```bash
screenpipe export \
  --start 2026-07-20T09:27:43Z \
  --end 2026-07-20T09:34:08Z \
  --output "/Users/kishorekumar/upGradVerse/submission/screenpipe-atlasverse-test-2026-07-20-145743-ist.mp4"
```

The retained video chunks are `1280 × 830` at roughly `0.1–0.15 captured frames per second`. Treat them as two-to-four-second sped-up making-of inserts, never as the final gameplay proof.

## Fresh capture order

1. Start the complete local stack with `npm run dev`.
2. Record the input selector and phone pairing first; keep both devices on the same Wi-Fi.
3. Capture a clean world traversal, car sequence, flying traffic, and metro pass. Test the newly mounted bike visually before recording it.
4. Capture one decisive visual moment from each Skill Shop and each result screen.
5. Capture the world skyline and central upGrad building for the opening and closing shots.
6. Record a short over-the-shoulder phone/controller insert if available.
7. Capture the in-world 3D arena: one movement beat, one clean hit, and the health/score response.
8. Listen back with game audio and licensed music together; preserve UI feedback and engine moments.

## 60-second fallback capture

If the deadline becomes critical, make this compact proof instead of a rushed three-minute film:

| Time | Shot |
| --- | --- |
| `00:00–00:05` | Title over the strongest skyline/car shot. |
| `00:05–00:13` | Input selector: keyboard, gamepad, QR phone. |
| `00:13–00:25` | Run, jump, camera orbit, enter car, drive past upGrad building. |
| `00:25–00:38` | ChatGPT Skill Shop: route a task, patch, retest, score. |
| `00:38–00:50` | Claude Studio: combine sources, choose evidence, verify artifact. |
| `00:50–00:56` | Enter the Verse Fight Ring and land one clean 3D combat hit. |
| `00:56–01:00` | End card: **UPGRADVERSE — THE WORLD OF AI SKILLS**. |

Use fresh 60 fps gameplay for the entire fallback. Omit Screenpipe and any newly added transport shot that has not passed visual QA.
