import { CUES, PhysicsMode, SKINS, xpForLevel } from "./constants";

export interface Settings {
  physics: PhysicsMode;
  sound: boolean;
  music: boolean;
  guides: boolean;
  timer: boolean;
  haptics: boolean;
  difficulty: string;
  skin: string;
  twoPlayer: boolean;
}

export interface Profile {
  name: string;
  coins: number;
  xp: number;
  wins: number;
  losses: number;
  pots: number;
  bestBreak: number;
  longestRun: number;
  ownedCues: string[];
  cue: string;
  ownedSkins: string[];
  settings: Settings;
}

const KEY = "eightball.profile.v1";

const defaults = (): Profile => ({
  name: "You",
  coins: 2500,
  xp: 0,
  wins: 0,
  losses: 0,
  pots: 0,
  bestBreak: 0,
  longestRun: 0,
  ownedCues: [CUES[0].id],
  cue: CUES[0].id,
  ownedSkins: [SKINS[0].id, SKINS[1].id],
  settings: {
    physics: "high",
    sound: true,
    music: false,
    guides: true,
    timer: true,
    haptics: true,
    difficulty: "pro",
    skin: "emerald",
    twoPlayer: false,
  },
});

function load(): Profile {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults();
    const p = JSON.parse(raw) as Partial<Profile>;
    const d = defaults();
    return {
      ...d,
      ...p,
      settings: { ...d.settings, ...(p.settings ?? {}) },
      ownedCues: Array.from(new Set([...d.ownedCues, ...(p.ownedCues ?? [])])),
      ownedSkins: Array.from(new Set([...d.ownedSkins, ...(p.ownedSkins ?? [])])),
    };
  } catch {
    return defaults();
  }
}

type Listener = () => void;

class Store {
  private state: Profile = load();
  private listeners = new Set<Listener>();

  get = () => this.state;

  subscribe = (l: Listener) => {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  };

  private commit(next: Profile) {
    this.state = next;
    try {
      localStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* ignore quota / privacy mode */
    }
    this.listeners.forEach((l) => l());
  }

  set(patch: Partial<Profile>) {
    this.commit({ ...this.state, ...patch });
  }

  setSetting<K extends keyof Settings>(k: K, v: Settings[K]) {
    this.commit({ ...this.state, settings: { ...this.state.settings, [k]: v } });
  }

  get level() {
    let lvl = 1;
    let xp = this.state.xp;
    while (xp >= xpForLevel(lvl)) {
      xp -= xpForLevel(lvl);
      lvl++;
      if (lvl > 200) break;
    }
    return lvl;
  }

  get levelProgress() {
    let lvl = 1;
    let xp = this.state.xp;
    while (xp >= xpForLevel(lvl)) {
      xp -= xpForLevel(lvl);
      lvl++;
      if (lvl > 200) break;
    }
    return { level: lvl, into: xp, need: xpForLevel(lvl), pct: xp / xpForLevel(lvl) };
  }

  addCoins(n: number) {
    this.commit({ ...this.state, coins: Math.max(0, this.state.coins + n) });
  }

  addXp(n: number) {
    this.commit({ ...this.state, xp: Math.max(0, this.state.xp + n) });
  }

  buy(kind: "cue" | "skin", id: string, price: number) {
    if (this.state.coins < price) return false;
    if (kind === "cue") {
      if (this.state.ownedCues.includes(id)) return false;
      this.commit({
        ...this.state,
        coins: this.state.coins - price,
        ownedCues: [...this.state.ownedCues, id],
        cue: id,
      });
    } else {
      if (this.state.ownedSkins.includes(id)) return false;
      this.commit({
        ...this.state,
        coins: this.state.coins - price,
        ownedSkins: [...this.state.ownedSkins, id],
        settings: { ...this.state.settings, skin: id },
      });
    }
    return true;
  }

  reset() {
    this.commit(defaults());
  }
}

export const store = new Store();
