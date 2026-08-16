import { createContext, useContext, useSyncExternalStore } from "react";
import { ReflectometryStore, type ReflectometrySnapshot } from "../runtime/reflectometry-store.ts";

export const StoreContext = createContext<ReflectometryStore | null>(null);

export function useReflectometryStore() {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useReflectometryStore must be used inside ReflectometryProvider.");
  return store;
}

export function useReflectometry(): [ReflectometrySnapshot, ReflectometryStore] {
  const store = useReflectometryStore();
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  return [snapshot, store];
}
