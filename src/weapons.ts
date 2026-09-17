/** Additional organic weapons can implement this contract without changing enemy states. */
export interface WeaponDefinition {
  id: string;
  name: string;
  damage: number;
  projectileSpeed: number;
  fireInterval: number;
  canPin: boolean;
  pellets: number;
  spread: number;
  maxAmmo: number;
  ammoName: string;
}
export const BONE_LAUNCHER: WeaponDefinition = {
  id: "femur",
  name: "Uyluk Kemiği Fırlatıcısı",
  damage: 65,
  projectileSpeed: 48,
  fireInterval: 0.46,
  canPin: true,
  pellets: 1,
  spread: 0,
  maxAmmo: 80,
  ammoName: "KEMİK",
};
export type WeaponId = "femur" | "shotgun" | "acid";
export const WEAPONS: Record<WeaponId, WeaponDefinition> = {
  femur: BONE_LAUNCHER,
  shotgun: {
    id: "shotgun",
    name: "Çifte Aforoz",
    damage: 23,
    projectileSpeed: 95,
    fireInterval: 0.76,
    canPin: false,
    pellets: 9,
    spread: 0.085,
    maxAmmo: 40,
    ammoName: "FİŞEK",
  },
  acid: {
    id: "acid",
    name: "Safra Bezi",
    damage: 23,
    projectileSpeed: 24,
    fireInterval: 0.17,
    canPin: false,
    pellets: 1,
    spread: 0.013,
    maxAmmo: 180,
    ammoName: "ASİT",
  },
};
