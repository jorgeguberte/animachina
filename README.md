# Animachina

**Adaptive performance engine for living attractions.**

Animachina is an experiment in adaptive dark rides: scenes, characters and ride vehicles perform a story together in real time.

The engine is deliberately built around **dramatic intent**, not around AI calls.

## Core loop

```text
Creative Intent
      ↓
     Beat
      ↓
  World State
      ↓
Decision Policy  ← Jev belongs here
      ↓
Vehicle intention
      ↓
Deterministic movement + staging
      ↓
Actor / scene performance
      ↓
  New World State
      ↺
```

A policy never drives frame-by-frame coordinates. It chooses among concrete, authored possibilities. Movement, timing, animation, physics and show control stay deterministic.

## Core concepts

- **Scene** — a bounded piece of the attraction with its own creative intent and state.
- **Beat** — a dramatic opportunity inside a scene. It exposes possible actions rather than prescribing one script.
- **Vehicle** — both physical body and performer. Personality can change how the same intention is embodied.
- **Actor** — anything in the environment that can perform: character, fountain, statue, light, prop, set piece.
- **Affordance** — a concrete possibility exposed by the current beat.
- **Performance** — the staged response produced by vehicle + actors + environment.
- **WorldState** — the current truth of the scene.
- **DecisionPolicy** — the pre-cortex boundary. Today the demo uses a deterministic local policy; Jev will implement the same interface.

## v0 demo

The first scene is intentionally tiny:

- top-down Three.js using an `OrthographicCamera`
- one plaza
- one ride vehicle
- fountain, statue, flowers and a small creature
- three guest/vehicle personalities:
  - 💎 Glamorous
  - 🫣 Shy
  - 😈 Chaotic

Run the exact same scene with each personality. The local policy chooses a different affordance and the vehicle performs the approach differently.

That is the whole proof:

> same scene, same actors, different performance.

## Why the top-down hack?

The world model is renderer-independent. The prototype lives on the X/Z plane, but the runtime already thinks in scene-space rather than screen-space.

Moving to a 3D presentation later should primarily mean replacing stagecraft:

- orthographic camera → perspective camera
- simple meshes → authored sets / characters
- procedural motion → animation / steering / ride hardware model

The contracts between Scene, Beat, Vehicle, Actor, WorldState and DecisionPolicy should survive.

## Jev integration

`src/engine/policy.ts` is the seam.

The Jev adapter should receive compact semantic context and choose **one of the affordance IDs the scene already exposes**. It should not invent coordinates, directly animate actors, or become a general-purpose story generator.

In other words:

> Jev decides **what makes sense next**. Animachina decides **how the show performs it**.

## Run

```bash
npm install
npm run dev
```

## Status

v0: engine skeleton + first adaptive scene.

Next: wire the real Jev policy and compare the same scene across repeated runs.
