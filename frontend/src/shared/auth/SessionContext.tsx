/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  guardarSesion,
  leerSesion,
  limpiarSesion,
  type SesionUsuario
} from "./sessionStorage";

interface SessionContextValue {
  sesion: SesionUsuario | null;
  iniciarSesion: (sesion: SesionUsuario) => void;
  cerrarSesion: () => void;
}

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<SesionUsuario | null>(() => leerSesion());

  const value = useMemo<SessionContextValue>(
    () => ({
      sesion,
      iniciarSesion(next) {
        guardarSesion(next);
        setSesion(next);
      },
      cerrarSesion() {
        limpiarSesion();
        setSesion(null);
      }
    }),
    [sesion]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSesion() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSesion debe usarse dentro de SessionProvider");
  return ctx;
}
