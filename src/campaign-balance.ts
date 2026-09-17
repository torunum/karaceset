import { ENEMIES, type EnemyKind } from './enemy-types';
import { WEAPONS, type WeaponId } from './weapons';
import type { Spawn } from './level';

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES = {
  easy: { enemyCountScale: .6, windupScale: 1.25, ammoScale: 1.4 },
  normal: { enemyCountScale: 1, windupScale: 1, ammoScale: 1 },
  hard: { enemyCountScale: 1.3, windupScale: .8, ammoScale: .85 },
} as const;
export const CAMPAIGN_PLAYER_SPEED = 9.2;
export const CAMPAIGN_START_AMMO: Readonly<Record<WeaponId, number>> = { femur: 10, shotgun: 0, acid: 0 };
export const CAMPAIGN_START_WEAPONS: readonly WeaponId[] = ['femur'];

/** Difficulty changes placement, reactions and resources, never enemy hit points. */
export function campaignEnemyHp(kind: EnemyKind): number {
  return kind === 'cultist' ? 70 : kind === 'shambler' ? 95 : ENEMIES[kind].hp;
}
export function campaignWindup(kind: EnemyKind, difficulty: Difficulty): number {
  return ENEMIES[kind].windup * DIFFICULTIES[difficulty].windupScale;
}

export interface CampaignAmmoGrant {
  weapon: WeaponId;
  amount: number;
  unlock?: boolean;
  secret?: boolean;
}
/** Keys match the authored organPickups order. Health slots have no ammo grant. */
export const CAMPAIGN_AMMO_GRANTS: Readonly<Record<number, Readonly<CampaignAmmoGrant>>> = {
  0: { weapon: 'femur', amount: 2 },
  1: { weapon: 'shotgun', amount: 3, unlock: true },
  3: { weapon: 'femur', amount: 2 },
  4: { weapon: 'acid', amount: 6, unlock: true },
  6: { weapon: 'shotgun', amount: 2 },
  7: { weapon: 'acid', amount: 4 },
  9: { weapon: 'femur', amount: 2 },
  10: { weapon: 'shotgun', amount: 1 },
  12: { weapon: 'femur', amount: 2 },
  13: { weapon: 'shotgun', amount: 1 },
  15: { weapon: 'shotgun', amount: 1 },
  16: { weapon: 'femur', amount: 3, secret: true },
};
export function campaignPickupGrant(index: number, difficulty: Difficulty = 'normal'): CampaignAmmoGrant | undefined {
  const grant = CAMPAIGN_AMMO_GRANTS[index];
  if (!grant) return undefined;
  // Cumulative rounding preserves the per-weapon budget with small one-round
  // bundles; independent rounding would silently turn hard's 85% into almost 100%.
  const previous = Object.entries(CAMPAIGN_AMMO_GRANTS).reduce((sum,[key,value]) =>
    Number(key) < index && value.weapon === grant.weapon && !!value.secret === !!grant.secret ? sum + value.amount : sum, 0);
  const scale = DIFFICULTIES[difficulty].ammoScale;
  return { ...grant, amount: Math.round((previous + grant.amount) * scale) - Math.round(previous * scale) };
}

/** Root supplies checked, distinct hard-mode positions; never create overlapping clones.
 * Easy distributes removals over the authored encounter order, retaining the opening. */
export function campaignSpawns<T>(base: readonly T[], hardExtras: readonly T[], difficulty: Difficulty): T[] {
  const count = Math.round(base.length * DIFFICULTIES[difficulty].enemyCountScale);
  if (difficulty === 'hard') {
    if (hardExtras.length < count - base.length) throw new Error('Not enough authored hard-mode spawn positions');
    return [...base, ...hardExtras.slice(0, count - base.length)];
  }
  if (difficulty === 'normal') return [...base];
  return Array.from({ length: count }, (_, i) => base[Math.floor(i * base.length / count)]);
}

export const CAMPAIGN_HARD_EXTRAS: readonly Spawn[] = [
  {x:3,z:-32,zone:1,kind:'cultist'}, {x:7,z:-36,zone:1,kind:'shambler'},
  {x:-17,z:-41,zone:1,kind:'cultist'}, {x:23,z:-44,zone:2,kind:'shambler'},
  {x:6,z:-56,zone:2,kind:'cultist'}, {x:7,z:-79,zone:3,kind:'shambler'},
  {x:0,z:-85,zone:3,kind:'cultist'}, {x:10,z:-84,zone:3,kind:'shambler'},
  {x:5,z:-90,zone:3,kind:'shambler'},
];
export function campaignRoster(base: readonly Spawn[], difficulty: Difficulty): Spawn[] {
  if (difficulty !== 'easy') return campaignSpawns(base,CAMPAIGN_HARD_EXTRAS,difficulty);
  const opening=base.filter(spawn=>spawn.zone===0);
  const later=base.filter(spawn=>spawn.zone!==0);
  const count=Math.max(0,Math.round(base.length*.6)-opening.length);
  return [...opening,...Array.from({length:count},(_,i)=>later[Math.floor(i*later.length/count)])];
}

/** Shotgun is an ideal all-nine-pellets ceiling. Excludes headshots, orb boosts,
 * kick damage, barrel damage, enemy drops and optional secret rewards by default. */
export function campaignAmmoAudit(
  spawns: readonly { kind: EnemyKind }[],
  difficulty: Difficulty = 'normal',
  includeSecrets = false,
) {
  const ammo: Record<WeaponId, number> = { ...CAMPAIGN_START_AMMO };
  for (const index of Object.keys(CAMPAIGN_AMMO_GRANTS)) {
    const grant = campaignPickupGrant(Number(index), difficulty)!;
    if (!grant.secret || includeSecrets) ammo[grant.weapon] += grant.amount;
  }
  const enemyHp = spawns.reduce((sum, spawn) => sum + campaignEnemyHp(spawn.kind), 0);
  const potentialDamage = (Object.keys(ammo) as WeaponId[]).reduce((sum, weapon) => sum + ammo[weapon] * WEAPONS[weapon].damage * WEAPONS[weapon].pellets, 0);
  return { ammo, enemyHp, potentialDamage, ratio: enemyHp ? potentialDamage / enemyHp : 0 };
}
