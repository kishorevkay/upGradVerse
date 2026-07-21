# upGradVerse — A Playable World for AI Skills

## One-line pitch

A browser-native 3D learning world where AI skills become places, missions, and repeatable practice.

## Description

upGradVerse turns AI learning from a catalogue of videos into a place you can explore. Players enter a browser-native 3D city, move with keyboard, controller, or a phone-based gamepad, and travel between modular Skill Shops. The playable prototype includes driving, a mounted motorbike, animated characters, flying traffic, cyber metro, and spatial navigation. Its ChatGPT Skill Shop teaches model routing, context selection, and repair-and-test loops, while Claude Artifact Studio teaches synthesis, evidence, and verification. Every choice produces immediate visual feedback and a score, so abstract AI habits become embodied decisions. The world is designed as a scalable shell: new shops can be added as tools and workflows evolve, while the same avatar, controls, progression, and social layer carry across the experience. It is learning designed like a game world, not a course page.

## Problem

AI skills change faster than conventional course catalogues. The material is often passive, tool-specific, and detached from the decisions people must make while working: choosing the right level of intelligence, supplying useful context, checking evidence, recovering from failure, and verifying an output before shipping it.

## Solution

upGradVerse makes those decisions playable. A persistent 3D world acts as the navigation layer, and each Skill Shop contains a short visual learning loop. The current prototype lets a player explore the city, drive vehicles, enter two working Skill Shops, receive immediate feedback, earn scores, and use keyboard, a physical controller, or a QR-paired phone controller. The modular structure allows new lessons to be added without rebuilding the world.

## OpenAI / Codex build story

Kish directed the concept, learning design, visual language, and hands-on controller testing. Codex was the primary engineering collaborator: it inspected the evolving prototype, translated feedback into scoped implementation work, integrated Three.js systems and GLB assets, debugged character and vehicle controls, built input and phone-controller flows, and repeatedly validated production builds. The result is not a static concept film; it is an executable browser prototype shaped through a rapid human-plus-Codex feedback loop.

## Technology

- Three.js `0.179.1` for the 3D world, camera, lighting, animation, vehicles, citizens, and spatial interactions.
- Vite `5.4.x`, modern JavaScript modules, HTML, and CSS.
- GLB assets loaded through Three.js `GLTFLoader`, with attribution retained for third-party assets.
- Browser Gamepad API and DualSense haptics for controller play.
- Web Audio API for procedural ambience, vehicle sound, and interaction feedback, plus a separately attributed licensed in-world music track.
- QR generation plus a local WebSocket relay for same-Wi-Fi phone control.
- Local browser storage for Skill Shop progress and rewards.

### Runtime disclosure

The current executable does not call the OpenAI API. OpenAI Codex was used as the build collaborator. The ChatGPT Skill Shop is a simulated learning experience, and its prototype model labels are teaching abstractions rather than claims about released OpenAI models.

## Future

- Connect Skill Shop missions to live OpenAI models, tool use, structured evaluations, and personalized feedback.
- Add persistent identity, avatars, skill passports, shareable outcomes, and multiplayer presence.
- Let educators and creators publish their own versioned Skill Shops.
- Expand the current in-world 3D fight arena with deeper opponent styles, progression, and tournament missions.
- Add denser city systems, accessible controls, analytics, and a production-grade secure phone relay.
