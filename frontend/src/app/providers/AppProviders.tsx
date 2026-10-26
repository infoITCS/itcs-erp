import { QueryClientProvider } from "@tanstack/react-query";
import { AuthBootstrap } from "./AuthBootstrap.tsx";
import { AppRouter } from "../router/AppRouter.tsx";
import { queryClient } from "./query-client.ts";

export function AppProviders() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <AppRouter />
      </AuthBootstrap>
    </QueryClientProvider>
  );
}
