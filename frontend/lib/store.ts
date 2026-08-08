import { configureStore } from "@reduxjs/toolkit";

import { authApi } from "@/lib/api/authApi";
import { leadsApi } from "@/lib/api/leadsApi";

export function makeStore() {
  return configureStore({
    reducer: {
      [leadsApi.reducerPath]: leadsApi.reducer,
      [authApi.reducerPath]: authApi.reducer,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware().concat(leadsApi.middleware, authApi.middleware),
  });
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];
