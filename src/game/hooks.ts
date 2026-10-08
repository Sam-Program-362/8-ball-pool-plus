import { useSyncExternalStore } from "react";
import { store } from "./store";

export function useProfile() {
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
