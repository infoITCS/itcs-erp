import { QueryClientProvider } from "@tanstack/react-query";
import { AppRouter } from "../router/AppRouter.tsx";
import { queryClient } from "./query-client.ts";

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}
