# upGradVerse Submission Pack

This folder contains a claim-checked submission draft for the current local upGradVerse prototype.

## Files

- `SUBMISSION_COPY.md` — title, short pitch, description, problem, solution, Codex build story, technology, disclosure, and future direction.
- `DEMO_VIDEO_PLAN.md` — a `02:55` edit structure, safe retained Screenpipe ranges, export commands, fresh-capture order, and a 60-second fallback.
- `ASSET_CHECKLIST.md` — current assets, required captures, submission dependencies, licensing checks, and truth gates.
- `SUBMISSION_READY.md` — exact deadline, live URLs, and the remaining manual Devpost actions.

## Current verified state

- Project inspected at `/Users/kishorekumar/upGradVerse` on `2026-07-22 IST`.
- Stack confirmed from `package.json`: Vite, Three.js, QR code generation, and WebSockets.
- A production build was validated and deployed to `https://upgradverse.vercel.app`. The hosted world, GLB avatar, arena entry, 3D combat, and fight HUD passed browser smoke testing.
- This submission pass intentionally edited only files inside `submission/`. Separate implementation work continued concurrently in the project; the claims in this pack were refreshed against the resulting current source.
- The retained Screenpipe index was read locally only to locate safe process-footage ranges; no footage was exported, uploaded, or fabricated by this submission pass.

## Run locally

```bash
cd "/Users/kishorekumar/upGradVerse"
npm run dev
```

The launcher serves the world on port `8050` and the local phone-controller relay on port `8051`. The computer and phone must be on the same Wi-Fi for phone pairing.

## Before submission

1. Resolve every unchecked critical item in `ASSET_CHECKLIST.md`.
2. Record fresh 60 fps gameplay using `DEMO_VIDEO_PLAN.md`.
3. Use the verified deadline and requirements in `SUBMISSION_READY.md`, then recheck the live form before the final click.
4. Re-run the production build and complete a clean end-to-end playthrough.
5. Keep the runtime disclosure accurate unless an OpenAI API integration is added and verified.
