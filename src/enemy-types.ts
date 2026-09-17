export type EnemyKind = "runner" | "spitter" | "cultist" | "brute" | "shambler";
export interface EnemyDefinition {
  name: string;
  hp: number;
  radius: number;
  center: number;
  speed: number;
  range: number;
  windup: number;
  cooldown: number;
  damage: number;
  ranged: boolean;
}
export const ENEMIES: Record<EnemyKind, EnemyDefinition> = {
  runner: {
    name: "Deri Yüzülmüş",
    hp: 65,
    radius: 0.48,
    center: 1.05,
    speed: 3.1,
    range: 1.4,
    windup: 0.48,
    cooldown: 1.1,
    damage: 12,
    ranged: false,
  },
  spitter: {
    name: "Safra Taşıyıcısı",
    hp: 130,
    radius: 0.62,
    center: 1.12,
    speed: 1.4,
    range: 13,
    windup: 0.9,
    cooldown: 2.4,
    damage: 15,
    ranged: true,
  },
  cultist: {
    name: "Kül Müritleri",
    hp: 95,
    radius: 0.46,
    center: 1.08,
    speed: 1.75,
    range: 19,
    windup: 0.75,
    cooldown: 1.9,
    damage: 12,
    ranged: true,
  },
  brute: {
    name: "Mezbahacı",
    hp: 240,
    radius: 0.76,
    center: 1.28,
    speed: 1.55,
    range: 1.8,
    windup: 1.05,
    cooldown: 1.8,
    damage: 25,
    ranged: false,
  },
  shambler: {
    name: "Dirilmiş",
    hp: 80,
    radius: 0.46,
    center: 1.02,
    speed: 1.15,
    range: 1.4,
    windup: 0.72,
    cooldown: 1.5,
    damage: 10,
    ranged: false,
  },
};
