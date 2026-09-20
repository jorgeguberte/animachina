import type { ShowSpec } from "../show/model";

export const plazaShow: ShowSpec = {
  lightCapabilities: [
    {
      id: "focus-actor",
      label: "Focus actor",
      description:
        "Lower the surrounding world slightly and draw a warm pool of attention around the performing actor.",
    },
    {
      id: "follow-vehicle",
      label: "Follow vehicle",
      description:
        "Let a soft moving light acknowledge the ride vehicle as part of the exchange.",
    },
    {
      id: "dim-world",
      label: "Dim world",
      description:
        "Pull ambient illumination down so small motion and sound become more intimate.",
    },
    {
      id: "warm-world",
      label: "Warm world",
      description:
        "Shift the scene toward a warm theatrical glow without isolating a single performer.",
    },
    {
      id: "cool-world",
      label: "Cool world",
      description:
        "Shift the scene cooler and more nocturnal, creating distance, wonder or uncertainty.",
    },
    {
      id: "pulse-world",
      label: "Pulse world",
      description:
        "Let practical lights around the plaza swell once as a shared environmental acknowledgement.",
    },
    {
      id: "hold-light",
      label: "Hold lighting",
      description:
        "Preserve the current lighting and let the performer carry the moment without extra emphasis.",
    },
  ],
  soundCapabilities: [
    {
      id: "chime",
      label: "Chime",
      description:
        "A clear bell-like punctuation that makes the moment feel noticed or magical.",
    },
    {
      id: "shimmer",
      label: "Shimmer",
      description:
        "A light harmonic sparkle that supports wonder without becoming a melody.",
    },
    {
      id: "low-hit",
      label: "Low hit",
      description:
        "A short low-frequency theatrical accent with weight and surprise.",
    },
    {
      id: "rustle",
      label: "Rustle",
      description:
        "A textured spatial whisper that makes the environment itself seem alive.",
    },
    {
      id: "swell",
      label: "Swell",
      description:
        "A soft tonal rise that gently enlarges the emotional scale of the moment.",
    },
    {
      id: "chirp",
      label: "Chirp",
      description:
        "A tiny playful high-pitched response, suitable for curious or comic punctuation.",
    },
    {
      id: "silence",
      label: "Intentional silence",
      description:
        "Add no sound. Preserve negative space so motion and anticipation remain exposed.",
    },
  ],
  setMotionCapabilities: [
    {
      id: "ring-turn",
      label: "Turn scenic ring",
      description:
        "Rotate the decorative outer floor ring slightly, making the plaza itself feel mechanically alive.",
    },
    {
      id: "wings-open",
      label: "Open scenic wings",
      description:
        "Let the four scenic wings ease outward as though the space is making room for the moment.",
    },
    {
      id: "wings-sway",
      label: "Sway scenic wings",
      description:
        "Give the outer scenic pieces a restrained synchronized sway.",
    },
    {
      id: "plaza-breathe",
      label: "Plaza breathes",
      description:
        "Expand and settle the outer scenic architecture with a subtle breathing motion.",
    },
    {
      id: "counter-turn",
      label: "Counter-turn",
      description:
        "Rotate the decorative ring opposite the vehicle's visual flow for gentle theatrical tension.",
    },
    {
      id: "hold-set",
      label: "Hold set",
      description:
        "Keep scenic machinery still and allow the actor, light and sound to carry the beat.",
    },
  ],
};
