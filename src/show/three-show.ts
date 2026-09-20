import * as THREE from "three";

import type { ActorDefinition } from "../engine/model";
import type { StageDecisionEvent } from "./model";

type ActiveShowEffect = {
  cue: StageDecisionEvent;
  elapsed: number;
};

const smooth = (value: number) => {
  const x = Math.min(1, Math.max(0, value));
  return x * x * (3 - 2 * x);
};

function effectEnvelope(
  elapsed: number,
  anticipation: number,
  sustain: number,
) {
  const local = elapsed - anticipation;

  if (local <= 0) return 0;

  const attack = 0.24;
  const release = 0.7;

  if (local < attack) {
    return smooth(local / attack);
  }

  if (local < attack + sustain) {
    return 1;
  }

  if (local < attack + sustain + release) {
    return 1 - smooth((local - attack - sustain) / release);
  }

  return 0;
}

class WebAudioSoundRig {
  private context?: AudioContext;
  private master?: GainNode;
  private voices = new Set<AudioScheduledSourceNode>();

  get enabled() {
    return Boolean(this.context && this.context.state === "running");
  }

  async unlock() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.2;
      this.master.connect(this.context.destination);
    }

    if (this.context.state === "suspended") {
      await this.context.resume();
    }
  }

  async setEnabled(enabled: boolean) {
    if (enabled) await this.unlock();
    else if (this.context?.state === "running") await this.context.suspend();
  }

  reset() {
    for (const voice of this.voices) {
      try {
        voice.stop();
      } catch {
        /* already ended */
      }
    }
    this.voices.clear();
    if (!this.context || !this.master) return;

    const now = this.context.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setTargetAtTime(0.2, now, 0.04);
  }

  trigger(
    cueId: string,
    energy: number,
    anticipation: number,
    sustain: number,
    pan: number,
  ) {
    if (!this.context || !this.master || !this.enabled || cueId === "silence") {
      return;
    }

    const start = this.context.currentTime + anticipation;
    const amount = Math.max(0.05, Math.min(1, energy));

    switch (cueId) {
      case "chime":
        this.tone(660, start, 0.75, amount * 0.28, "sine", pan, 990);
        this.tone(990, start + 0.08, 0.62, amount * 0.18, "sine", pan, 1320);
        break;

      case "shimmer":
        this.tone(880, start, 1.05, amount * 0.12, "sine", pan, 1040);
        this.tone(1108, start + 0.07, 0.9, amount * 0.1, "triangle", pan, 1320);
        this.tone(1320, start + 0.14, 0.76, amount * 0.08, "sine", pan, 1660);
        break;

      case "low-hit":
        this.tone(105, start, 0.82, amount * 0.44, "sine", pan, 48);
        this.tone(205, start, 0.35, amount * 0.1, "triangle", pan, 115);
        break;

      case "rustle":
        this.noise(start, Math.max(0.5, sustain), amount * 0.2, pan);
        break;

      case "swell":
        this.tone(
          196,
          start,
          Math.max(0.9, sustain),
          amount * 0.13,
          "sine",
          pan,
          247,
        );
        this.tone(
          294,
          start + 0.04,
          Math.max(0.8, sustain),
          amount * 0.08,
          "sine",
          pan,
          392,
        );
        break;

      case "chirp":
        this.tone(620, start, 0.18, amount * 0.2, "triangle", pan, 1080);
        this.tone(780, start + 0.2, 0.15, amount * 0.14, "triangle", pan, 1320);
        break;
    }
  }

  private connectPanner(source: AudioNode, pan: number) {
    if (!this.context || !this.master) return;

    const panner = this.context.createStereoPanner();
    panner.pan.value = Math.max(-0.9, Math.min(0.9, pan));
    source.connect(panner);
    panner.connect(this.master);
  }

  private tone(
    frequency: number,
    start: number,
    duration: number,
    amplitude: number,
    type: OscillatorType,
    pan: number,
    endFrequency = frequency,
  ) {
    if (!this.context) return;

    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, endFrequency),
      start + duration,
    );

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, amplitude),
      start + Math.min(0.08, duration * 0.25),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    oscillator.connect(gain);
    this.connectPanner(gain, pan);

    this.voices.add(oscillator);
    oscillator.onended = () => {
      this.voices.delete(oscillator);
      oscillator.disconnect();
      gain.disconnect();
    };
    oscillator.start(start);
    oscillator.stop(start + duration + 0.04);
  }

  private noise(
    start: number,
    duration: number,
    amplitude: number,
    pan: number,
  ) {
    if (!this.context) return;

    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(
      1,
      Math.ceil(sampleRate * duration),
      sampleRate,
    );
    const channel = buffer.getChannelData(0);

    for (let i = 0; i < channel.length; i += 1) {
      channel[i] = Math.random() * 2 - 1;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();

    source.buffer = buffer;
    filter.type = "bandpass";
    filter.frequency.value = 1900;
    filter.Q.value = 0.8;

    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.001, amplitude),
      start + Math.min(0.18, duration * 0.3),
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

    source.connect(filter);
    filter.connect(gain);
    this.connectPanner(gain, pan);

    this.voices.add(source);
    source.onended = () => {
      this.voices.delete(source);
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    source.start(start);
    source.stop(start + duration + 0.04);
  }
}

export class ThreeShowController {
  private readonly actorLights = new Map<string, THREE.PointLight>();
  private readonly vehicleLight = new THREE.PointLight(0xffe1a3, 0, 4.5, 2);
  private readonly sound = new WebAudioSoundRig();

  private readonly scenicRoot = new THREE.Group();
  private readonly scenicRing = new THREE.Group();
  private readonly wings: THREE.Group[] = [];

  private active?: ActiveShowEffect;

  private readonly baseHemisphereIntensity: number;
  private readonly baseKeyIntensity: number;
  private readonly baseKeyColor: THREE.Color;
  private readonly baseSkyColor: THREE.Color;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly hemisphere: THREE.HemisphereLight,
    private readonly key: THREE.DirectionalLight,
    actors: readonly ActorDefinition[],
    private readonly vehicle: THREE.Object3D,
  ) {
    this.baseHemisphereIntensity = hemisphere.intensity;
    this.baseKeyIntensity = key.intensity;
    this.baseKeyColor = key.color.clone();
    this.baseSkyColor = hemisphere.color.clone();

    for (const actor of actors) {
      const light = new THREE.PointLight(0xffd98a, 0.06, 3.8, 2);
      light.position.set(actor.position.x, 1.8, actor.position.z);
      this.actorLights.set(actor.id, light);
      scene.add(light);
    }

    this.vehicleLight.position.set(0, 1.5, 0);
    scene.add(this.vehicleLight);

    this.buildScenicMachinery();
  }

  get soundEnabled() {
    return this.sound.enabled;
  }

  async unlockAudio() {
    await this.sound.unlock();
  }

  async setAudioEnabled(enabled: boolean) {
    await this.sound.setEnabled(enabled);
  }

  trigger(event: StageDecisionEvent) {
    this.active = {
      cue: event,
      elapsed: 0,
    };

    const actor = event.moment.actor;
    const pan = actor.position.x / 8;

    this.sound.trigger(
      event.decision.soundCueId,
      event.decision.energy,
      event.decision.anticipation,
      event.decision.sustain,
      pan,
    );
  }

  reset() {
    this.active = undefined;
    this.sound.reset();
    this.restoreBaseState();
  }

  update(dt: number, time: number) {
    this.restoreBaseState();

    if (!this.active) return;

    this.active.elapsed += dt;

    const { decision } = this.active.cue;
    const envelope = effectEnvelope(
      this.active.elapsed,
      decision.anticipation,
      decision.sustain,
    );

    const amount = envelope * decision.energy;

    this.applyLightCue(
      decision.lightCueId,
      this.active.cue.moment.actor.id,
      amount,
      time,
    );

    this.applySetMotion(decision.setMotionCueId, amount, time);

    const finishedAt = decision.anticipation + 0.24 + decision.sustain + 0.7;

    if (this.active.elapsed >= finishedAt) {
      this.active = undefined;
    }
  }

  private restoreBaseState() {
    this.hemisphere.intensity = this.baseHemisphereIntensity;
    this.hemisphere.color.copy(this.baseSkyColor);
    this.key.intensity = this.baseKeyIntensity;
    this.key.color.copy(this.baseKeyColor);

    for (const light of this.actorLights.values()) {
      light.intensity = 0.06;
    }

    this.vehicleLight.intensity = 0;
    this.vehicleLight.position.set(
      this.vehicle.position.x,
      1.5,
      this.vehicle.position.z,
    );

    this.scenicRoot.scale.setScalar(1);
    this.scenicRing.rotation.y = 0;

    for (const wing of this.wings) {
      const base = wing.userData.base as {
        x: number;
        z: number;
        rotationY: number;
      };

      wing.position.x = base.x;
      wing.position.z = base.z;
      wing.rotation.y = base.rotationY;
    }
  }

  private applyLightCue(
    cueId: string,
    actorId: string,
    amount: number,
    time: number,
  ) {
    switch (cueId) {
      case "focus-actor": {
        const actorLight = this.actorLights.get(actorId);

        if (actorLight) {
          actorLight.intensity = 0.1 + amount * 5.2;
        }

        this.hemisphere.intensity *= 1 - amount * 0.34;
        this.key.intensity *= 1 - amount * 0.18;
        break;
      }

      case "follow-vehicle":
        this.vehicleLight.intensity = amount * 4.2;
        this.hemisphere.intensity *= 1 - amount * 0.12;
        break;

      case "dim-world":
        this.hemisphere.intensity *= 1 - amount * 0.58;
        this.key.intensity *= 1 - amount * 0.48;
        break;

      case "warm-world": {
        const warm = new THREE.Color(0xffb96b);
        this.key.color.lerp(warm, amount * 0.8);
        this.key.intensity *= 1 + amount * 0.28;
        break;
      }

      case "cool-world": {
        const cool = new THREE.Color(0x8ebcff);
        this.hemisphere.color.lerp(cool, amount * 0.86);
        this.hemisphere.intensity *= 1 - amount * 0.08;
        break;
      }

      case "pulse-world": {
        const pulse = (0.45 + Math.sin(time * 7) * 0.35) * amount;

        for (const light of this.actorLights.values()) {
          light.intensity = 0.1 + pulse * 3.1;
        }

        this.key.intensity *= 1 + pulse * 0.16;
        break;
      }

      case "hold-light":
        break;
    }
  }

  private applySetMotion(cueId: string, amount: number, time: number) {
    switch (cueId) {
      case "ring-turn":
        this.scenicRing.rotation.y = amount * 0.68;
        break;

      case "counter-turn":
        this.scenicRing.rotation.y = -amount * 0.68;
        break;

      case "wings-open":
        for (const wing of this.wings) {
          const base = wing.userData.base as {
            x: number;
            z: number;
            rotationY: number;
          };
          const length = Math.hypot(base.x, base.z) || 1;
          wing.position.x += (base.x / length) * amount * 0.72;
          wing.position.z += (base.z / length) * amount * 0.72;
        }
        break;

      case "wings-sway":
        for (let index = 0; index < this.wings.length; index += 1) {
          const wing = this.wings[index];
          wing.rotation.y += Math.sin(time * 3 + index * 0.9) * amount * 0.34;
        }
        break;

      case "plaza-breathe": {
        const scale = 1 + amount * 0.045;
        this.scenicRoot.scale.setScalar(scale);
        break;
      }

      case "hold-set":
        break;
    }
  }

  private buildScenicMachinery() {
    const ringMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a7954,
      roughness: 0.78,
      metalness: 0.08,
    });

    for (let index = 0; index < 18; index += 1) {
      const angle = (index / 18) * Math.PI * 2;
      const tile = new THREE.Mesh(
        new THREE.BoxGeometry(0.58, 0.08, 0.16),
        ringMaterial,
      );

      tile.position.set(Math.cos(angle) * 4.62, 0.08, Math.sin(angle) * 4.62);
      tile.rotation.y = -angle;
      tile.castShadow = true;
      this.scenicRing.add(tile);
    }

    this.scenicRoot.add(this.scenicRing);

    const wingMaterial = new THREE.MeshStandardMaterial({
      color: 0x335a5b,
      roughness: 0.76,
      metalness: 0.04,
    });

    const lightMaterial = new THREE.MeshStandardMaterial({
      color: 0xf2c980,
      emissive: 0x6f4919,
      emissiveIntensity: 0.65,
      roughness: 0.45,
    });

    for (let index = 0; index < 4; index += 1) {
      const angle = (index / 4) * Math.PI * 2 + Math.PI / 4;
      const wing = new THREE.Group();
      const radius = 5.18;

      wing.position.set(
        Math.cos(angle) * radius,
        0.12,
        Math.sin(angle) * radius,
      );
      wing.rotation.y = -angle + Math.PI / 2;

      wing.userData.base = {
        x: wing.position.x,
        z: wing.position.z,
        rotationY: wing.rotation.y,
      };

      for (let panelIndex = -1; panelIndex <= 1; panelIndex += 1) {
        const panel = new THREE.Mesh(
          new THREE.BoxGeometry(0.72, 0.18, 0.26),
          wingMaterial,
        );
        panel.position.x = panelIndex * 0.66;
        panel.castShadow = true;
        wing.add(panel);
      }

      const practical = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 14, 10),
        lightMaterial,
      );
      practical.position.y = 0.18;
      wing.add(practical);

      this.wings.push(wing);
      this.scenicRoot.add(wing);
    }

    this.scene.add(this.scenicRoot);
  }
}
