import type { ReactNode } from "react";
import { SessionProvider } from "@/shared/auth/SessionContext";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  return <SessionProvider>{children}</SessionProvider>;
}
