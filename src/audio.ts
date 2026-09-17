import { audioChannel, occludedMix, type AudioChannel } from "./audio-spatial";
export type SoundEvent =
  | "fire"
  | "bone"
  | "flesh"
  | "alert"
  | "spit"
  | "pickup"
  | "door"
  | "hurt"
  | "step"
  | "shotgun"
  | "acid"
  | "equip"
  | "kickWhoosh"
  | "kickImpact"
  | "break"
  | "explosion"
  | "sever"
  | "cultShot"
  | "chant"
  | "woodBreak"
  | "metalBreak"
  | "stoneBreak"
  | "reload"
  | "woodHit"
  | "metalHit"
  | "stoneHit";

type Layer = {
  samples: string[];
  gain: number;
  rate?: number;
  delay?: number;
  lowpass?: number;
};
const variants = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
const L = (
  samples: string[],
  gain: number,
  rate = 1,
  delay = 0,
  lowpass = 15000,
): Layer => ({ samples, gain, rate, delay, lowpass });
// Dry transients carry the weapon; wet Foley adds weight without masking the attack.
const EVENTS: Record<SoundEvent, Layer[]> = {
  shotgun: [L(variants("shotgun", 3), 0.96), L(["metal-0"], 0.12, 0.9, 0.035)],
  cultShot: [L(["cult-shot"], 0.5, 1, 0, 7500)],
  fire: [
    L(["punch-1"], 0.7, 0.8),
    L(["bone"], 0.35, 0.8),
    L(["slime-1"], 0.22, 1.15),
  ],
  bone: [L(["bone"], 0.6, 1.05)],
  flesh: [L(variants("slime", 3), 0.56, 0.92), L(variants("punch", 3), 0.24)],
  alert: [L(["monster-0", "monster-3"], 0.42, 0.88)],
  spit: [L(["slime-2"], 0.5, 0.8)],
  acid: [L(variants("slime", 3), 0.36, 1.35)],
  pickup: [L(["shell"], 0.35, 1.15)],
  equip: [L(["cloth"], 0.26), L(["shell"], 0.3, 1.15, 0.08)],
  reload: [L(["reload"], 0.5)],
  door: [L(["metal-2"], 0.45, 0.42, 0, 1600), L(["slime-2"], 0.42, 0.45, 0.13)],
  hurt: [L(["punch-0"], 0.55), L(["monster-1"], 0.18, 1.2)],
  step: [L(variants("step", 4), 0.23)],
  kickWhoosh: [L(["cloth"], 0.32, 0.8)],
  kickImpact: [L(variants("punch", 3), 0.9, 0.82), L(["slime-0"], 0.22)],
  break: [L(variants("wood", 3), 0.65, 0.83), L(["bone"], 0.22, 0.9, 0.055)],
  woodHit: [L(["wood-0", "wood-1"], 0.3, 1.05)],
  metalHit: [L(["metal-0", "metal-1"], 0.28, 1.1)],
  stoneHit: [L(["stone-0", "stone-1"], 0.32)],
  woodBreak: [L(variants("wood", 3), 0.7, 0.8), L(["wood-2"], 0.25, 1.3, 0.08)],
  metalBreak: [
    L(variants("metal", 3), 0.7, 0.76),
    L(["metal-1"], 0.3, 1.2, 0.12),
  ],
  stoneBreak: [
    L(variants("stone", 3), 0.68, 0.78),
    L(["bone"], 0.34, 0.85, 0.06),
  ],
  explosion: [
    L(["shotgun-2"], 0.95, 0.62, 0, 4000),
    L(["metal-2"], 0.4, 0.58, 0.08),
    L(["stone-1"], 0.4, 0.7, 0.16),
  ],
  sever: [
    L(variants("slime", 3), 0.74, 0.75),
    L(["bone"], 0.45, 0.72),
    L(["punch-2"], 0.3),
  ],
  chant: [L(["monster-5"], 0.12, 0.52, 0, 900)],
};
const SAMPLE_NAMES = [
  ...new Set([
    ...Object.values(EVENTS).flatMap((layers) =>
      layers.flatMap((l) => l.samples),
    ),
    ...variants("monster", 6),
    "wet-room",
  ]),
];
const THROTTLE: Partial<Record<SoundEvent, number>> = {
  flesh: 0.055,
  bone: 0.055,
  sever: 0.07,
  alert: 0.65,
  chant: 4,
  step: 0.13,
  explosion: 0.08,
};
type Voice = {
  source: AudioBufferSourceNode;
  gain: GainNode;
  filter: BiquadFilterNode;
  panner: StereoPannerNode;
  priority: number;
};

export class AudioSystem {
  context: AudioContext | null = null;
  master: GainNode | null = null;
  volume = 0.45;
  channelVolumes: Record<AudioChannel, number> = {
    weapons: 1,
    creatures: 1,
    world: 1,
  };
  channels: Partial<Record<AudioChannel, GainNode>> = {};
  readonly buffers = new Map<string, AudioBuffer>();
  readonly failedSamples: string[] = [];
  ready: Promise<void> | null = null;
  private voices: Voice[] = [];
  private lastEvents = new Map<SoundEvent, number>();
  private lastVariant = new Map<string, string>();
  private ambience: AudioBufferSourceNode | null = null;
  private ambienceGain: GainNode | null = null;
  private playing = false;

  start() {
    this.playing = true;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      const limiter = this.context.createDynamicsCompressor();
      limiter.threshold.value = -9;
      limiter.knee.value = 5;
      limiter.ratio.value = 12;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.15;
      this.master.connect(limiter).connect(this.context.destination);
      for (const channel of Object.keys(
        this.channelVolumes,
      ) as AudioChannel[]) {
        const gain = this.context.createGain();
        gain.gain.value = this.channelVolumes[channel];
        gain.connect(this.master);
        this.channels[channel] = gain;
      }
      this.ready = this.preload();
    }
    void this.context.resume().catch(() => {
      /* A later player gesture can retry. */
    });
    this.startAmbience();
  }

  private async preload() {
    const context = this.context!;
    await Promise.all(
      SAMPLE_NAMES.map(async (name) => {
        try {
          const response = await fetch(
            `${import.meta.env.BASE_URL}audio/${name}.ogg`,
          );
          if (!response.ok) throw new Error(`Audio HTTP ${response.status}`);
          const buffer = await context.decodeAudioData(
            await response.arrayBuffer(),
          );
          this.buffers.set(name, buffer);
        } catch {
          this.failedSamples.push(name);
        }
      }),
    );
    // Loading failures are silent, never replaced by the old synthetic buzz.
    this.startAmbience();
  }

  private startAmbience() {
    if (!this.playing || this.ambience || !this.context || !this.master) return;
    const buffer = this.buffers.get("wet-room");
    if (!buffer) return;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    source.playbackRate.value = 0.75;
    gain.gain.setValueAtTime(0, this.context.currentTime);
    gain.gain.linearRampToValueAtTime(0.07, this.context.currentTime + 2);
    source.connect(gain).connect(this.channels.world ?? this.master);
    source.start();
    this.ambience = source;
    this.ambienceGain = gain;
  }

  setVolume(v: number) {
    this.volume = Number.isFinite(v)
      ? Math.max(0, Math.min(1, v))
      : this.volume;
    if (this.master && this.context)
      this.master.gain.setTargetAtTime(
        this.volume,
        this.context.currentTime,
        0.025,
      );
  }

  setChannelVolume(channel: AudioChannel, value: number) {
    if (!Number.isFinite(value)) return;
    this.channelVolumes[channel] = Math.max(0, Math.min(1, value));
    if (this.context)
      this.channels[channel]?.gain.setTargetAtTime(
        this.channelVolumes[channel],
        this.context.currentTime,
        0.025,
      );
  }
  pause() {
    this.playing = false;
    // Discard short effects so a paused explosion cannot resume minutes later.
    for (const voice of [...this.voices]) voice.source.stop();
    this.voices = [];
    this.lastEvents.clear();
    if (this.ambience) {
      this.ambience.stop();
      this.ambience.disconnect();
      this.ambienceGain?.disconnect();
      this.ambience = null;
      this.ambienceGain = null;
    }
    void this.context?.suspend();
  }

  play(event: SoundEvent, distance = 0, pan = 0, occlusion = 0) {
    const context = this.context;
    if (
      !context ||
      !this.master ||
      !this.playing ||
      context.state !== "running"
    )
      return;
    const now = context.currentTime;
    if (
      now - (this.lastEvents.get(event) ?? -Infinity) <
      (THROTTLE[event] ?? 0.015)
    )
      return;
    this.lastEvents.set(event, now);
    const priority = [
      "shotgun",
      "fire",
      "acid",
      "kickImpact",
      "reload",
    ].includes(event)
      ? 2
      : event === "step" || event === "chant"
        ? 0
        : 1;
    for (const layer of EVENTS[event]) {
      const available = layer.samples.filter((name) => this.buffers.has(name));
      if (!available.length) continue;
      const pool =
        available.length > 1
          ? available.filter((name) => name !== this.lastVariant.get(event))
          : available;
      const name = pool[Math.floor(Math.random() * pool.length)];
      this.lastVariant.set(event, name);
      if (this.voices.length >= 24) {
        const victim = this.voices.find((v) => v.priority <= priority);
        if (!victim) continue;
        victim.source.stop();
        this.voices.splice(this.voices.indexOf(victim), 1);
      }
      const source = context.createBufferSource(),
        gain = context.createGain(),
        filter = context.createBiquadFilter();
      source.buffer = this.buffers.get(name)!;
      source.playbackRate.value =
        (layer.rate ?? 1) * (0.97 + Math.random() * 0.06);
      const mix = occludedMix(distance, occlusion, layer.lowpass ?? 15000);
      gain.gain.value = layer.gain * mix.gain;
      const panner = context.createStereoPanner();
      panner.pan.value = Number.isFinite(pan)
        ? Math.max(-1, Math.min(1, pan))
        : 0;
      filter.type = "lowpass";
      filter.frequency.value = mix.lowpass;
      source
        .connect(filter)
        .connect(gain)
        .connect(panner)
        .connect(this.channels[audioChannel(event)] ?? this.master);
      const voice = { source, gain, filter, panner, priority };
      this.voices.push(voice);
      source.onended = () => {
        const i = this.voices.indexOf(voice);
        if (i >= 0) this.voices.splice(i, 1);
        source.disconnect();
        filter.disconnect();
        gain.disconnect();
        panner.disconnect();
      };
      source.start(now + (layer.delay ?? 0));
    }
  }
}
