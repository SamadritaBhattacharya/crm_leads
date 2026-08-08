"use client";

import { useState } from "react";
import { Provider } from "react-redux";

import { makeStore } from "@/lib/store";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  // Lazy useState initializer — runs exactly once per mount, no ref access
  // during render (react-hooks/refs).
  const [store] = useState(() => makeStore());
  return <Provider store={store}>{children}</Provider>;
}
