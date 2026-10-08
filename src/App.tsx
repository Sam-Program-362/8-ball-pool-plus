import { useEffect, useRef, useState } from "react";
import Background from "@/components/Background";
import Menu, { type MatchSetup } from "@/components/Menu";
import Shop from "@/components/Shop";
import Settings from "@/components/Settings";
import Game from "@/components/Game";
import { sfx } from "@/game/audio";
import { store } from "@/game/store";

type Screen = "menu" | "game" | "shop" | "settings";

export default function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [setup, setSetup] = useState<MatchSetup | null>(null);
  const matchKey = useRef(0);
  const booted = useRef(false);

  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    const wake = () => {
      sfx.resume();
      sfx.setSfx(store.get().settings.sound);
      if (store.get().settings.music) sfx.setMusic(true);
    };
    window.addEventListener("pointerdown", wake, { once: true });
    window.addEventListener("keydown", wake, { once: true });
    const prevent = (e: Event) => {
      if ((e as TouchEvent).touches && (e as TouchEvent).touches.length > 1) e.preventDefault();
    };
    document.addEventListener("touchmove", prevent, { passive: false });
    return () => {
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("keydown", wake);
      document.removeEventListener("touchmove", prevent);
    };
  }, []);

  return (
    <div className="relative h-full w-full overflow-hidden">
      <Background intensity={screen === "game" ? 0.45 : 1} />
      {screen === "menu" && (
        <Menu
          onPlay={(s) => {
            setSetup(s);
            matchKey.current++;
            setScreen("game");
          }}
          onShop={() => setScreen("shop")}
          onSettings={() => setScreen("settings")}
        />
      )}
      {screen === "shop" && <Shop onBack={() => setScreen("menu")} />}
      {screen === "settings" && <Settings onBack={() => setScreen("menu")} />}
      {screen === "game" && setup && (
        <Game key={matchKey.current} setup={setup} onExit={() => setScreen("menu")} />
      )}
    </div>
  );
}
