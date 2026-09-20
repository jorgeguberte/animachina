# Animachina

**Adaptive performance engine for living attractions.**

Animachina is an experiment in adaptive dark rides where scenes, characters and ride vehicles perform together in real time.

The engine is built around one boundary:

> **Content declares what performers can do. The policy decides what they do now.**

## Core loop

```text
Creative intent
      ↓
     Beat
      ↓
 World state
      ↓
derive opportunities from geometry + capabilities
      ↓
 DecisionPolicy   ← Jev
      ↓
intention + performance parameters
      ↓
deterministic movement / animation / show control
      ↓
 performers react
      ↓
 new world state
      ↺
```

## The anti-hardcoding rule

Animachina must not contain rules such as:

```text
glamorous → fountain
shy       → flowers
chaotic   → creature
```

A personality profile is **semantic context only**.

The engine knows physical truths:

- where the fountain is,
- what the vehicle can physically do,
- that the statue can turn, pose, or turn away,
- that the flowers can bloom, fold, or ripple,
- how to execute movement and animation safely.

It does **not** know which of those things a glamorous, shy, angry, curious, frightened, tired or completely new personality should prefer.

That judgment belongs to the policy.

## Core concepts

- **Scene** — bounded attraction space with creative intent, geometry and performers.
- **Beat** — dramatic intent plus broad action types and a completion condition. It is not a branch table.
- **Vehicle** — a physical performer with generic movement capabilities.
- **Actor** — a performer that declares its own finite capability vocabulary.
- **Opportunity** — derived at runtime from the current beat, spatial state and available performers.
- **Performance parameters** — speed, curvature, hesitation, dwell, facing, intensity, duration and similar continuous controls.
- **WorldState** — current scene truth plus recent events.
- **DecisionPolicy** — the pre-cortex seam.

## Performer grammar

Authoring answers:

> What can this thing physically do?

For example:

```text
fountain → pulse | burst | dim
statue   → turn-toward | turn-away | pose
flowers  → bloom | fold | ripple
creature → hop | hide | circle
```

The policy answers:

> Given who the guest is, what just happened, the active dramatic intent and the available capabilities, what makes sense now?

Animachina then executes the chosen capability deterministically.

## v0.1 demo

The first scene is **Moonlit Plaza**:

- top-down Three.js with an `OrthographicCamera`
- one vehicle
- fountain, statue, flowers and a small creature
- three semantic personality profiles: Glamorous, Shy and Chaotic
- two beats: arrival and departure

The arrival beat does **not** list authored routes to each actor. It only allows generic actions such as `approach`, `observe`, `orbit` and `linger`.

The runtime derives concrete opportunities from the current geometry.

### Why the local fallback behaves randomly

`LocalPolicy` is intentionally random and **personality-blind**.

That is a feature.

Before Jev is connected, selecting Glamorous must not magically produce glamorous behavior. If it does, the intelligence has leaked back into hardcoded engine rules.

The local policy exists only to exercise:

- dynamic opportunity generation,
- parameterized vehicle performance,
- actor capability selection,
- scene state transitions.

## Jev integration

Jev is now wired through `src/engine/jev-policy.ts`.

The browser never sees the TypeSafe API key. During local development, `vite.config.ts` exposes a same-origin `/api/system-one` proxy and forwards requests to TypeSafe from the Node side.

Create `.env.local`:

```bash
TYPESAFE_API_KEY=your_key_here
```

The integration deliberately uses **two-stage decisions**.

### Vehicle

**Call 1: what happens?**

Jev receives the personality, creative intent, active beat, current world state, recent events and the dynamically-derived opportunities. A Choice question selects one real opportunity.

**Call 2: how is it performed?**

The chosen opportunity is added to state. Independent Score / Choice questions judge speed, path curvature, curve side, hesitation, dwell and facing.

### Actor

**Call 1: what reaction?**

Jev chooses one capability the actor physically owns.

**Call 2: how is it performed?**

With that capability fixed, Jev judges intensity, duration and anticipation delay.

This follows the System One design rule: keep judgments atomic, then compose them in code.

If Jev is unavailable or the key is missing, the demo falls back to `LocalPolicy`. The debug overlay exposes the source, so a `local` decision cannot masquerade as Jev.

Jev still does not invent geometry or bypass physical capabilities.

In short:

> **Jev judges what makes sense. Animachina performs what is possible.**

## Why top-down first?

The runtime is renderer-independent. The prototype uses X/Z scene space with an orthographic camera, so the later 3D move is mostly a stagecraft swap:

- orthographic → perspective camera,
- primitives → authored sets and characters,
- simple steering → ride hardware / animation systems.

The policy and world contracts should survive.

## Run

```bash
npm install
npm run dev
```

## Status

v0.2: capability-driven runtime + real Jev System One policy + server-side API proxy + personality-blind fallback.

The experiment now has a falsifiable test:

> Run the same authored scene with different semantic personality descriptions. Distinct behavior should emerge from Jev decisions, **without adding personality-specific engine rules**.

Next: observe several runs, inspect Jev probabilities/confidence, and tune the semantic state/questions only where behavior is unclear.
