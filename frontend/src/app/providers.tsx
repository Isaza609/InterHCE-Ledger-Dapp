import type { ReactNode } from "react";

interface AppProvidersProps {
  children: ReactNode;
}

export function AppProviders({ children }: AppProvidersProps) {
  // Aquí más adelante se agregarán contextos (auth, rol, tema, wallet, etc.)
  return children;
}

