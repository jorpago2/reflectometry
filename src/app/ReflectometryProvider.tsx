import { useEffect, useState, type PropsWithChildren } from "react";
import { ReflectometryStore } from "../runtime/reflectometry-store.ts";
import { StoreContext } from "./reflectometry-context.ts";

export default function ReflectometryProvider({ children }: PropsWithChildren) {
  const [store] = useState(() => new ReflectometryStore());

  useEffect(() => () => store.dispose(), [store]);

  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}
