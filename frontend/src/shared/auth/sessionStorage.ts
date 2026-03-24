export type RolSesion =
  | "profesional_salud"
  | "admin_ips"
  | "paciente"
  | "auditor"
  | "super_admin";

export interface SesionUsuario {
  token: string;
  rol: RolSesion;
  ipsId?: string;
  usuarioId: string;
  nombre: string;
  correo: string;
  emitidaEn: string;
  expiraEn: string;
}

const STORAGE_KEY = "interhce_sesion";

export function leerSesion(): SesionUsuario | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SesionUsuario;
    if (!parsed?.rol || !parsed.token || !parsed.usuarioId) return null;
    if (Date.parse(parsed.expiraEn) <= Date.now()) {
      limpiarSesion();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function guardarSesion(sesion: SesionUsuario): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sesion));
}

export function limpiarSesion(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(STORAGE_KEY);
}
