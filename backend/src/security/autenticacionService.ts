import { randomUUID } from "crypto";
import {
  autenticarUsuario,
  obtenerUsuario,
  type UsuarioIps
} from "../access/accesoUsuariosService";
import type { ActorContexto } from "../hce/episodioLifecycleService";

const SESSION_TTL_MS = 1000 * 60 * 60 * 8;

export interface SesionAutenticada extends ActorContexto {
  token: string;
  nombre: string;
  correo: string;
  emitidaEn: string;
  expiraEn: string;
}

interface RegistroSesion {
  token: string;
  usuarioId: string;
  emitidaEn: string;
  expiraEn: string;
}

const sesiones = new Map<string, RegistroSesion>();

function limpiarSesionesExpiradas(): void {
  const now = Date.now();
  for (const [token, sesion] of sesiones.entries()) {
    if (Date.parse(sesion.expiraEn) <= now) {
      sesiones.delete(token);
    }
  }
}

function construirSesion(user: UsuarioIps, registro: RegistroSesion): SesionAutenticada {
  return {
    token: registro.token,
    usuarioId: user.usuarioId,
    rol: user.rol,
    ipsId: user.ipsId,
    nombre: user.nombre,
    correo: user.correo,
    emitidaEn: registro.emitidaEn,
    expiraEn: registro.expiraEn
  };
}

export function iniciarSesion(
  identificador: string,
  password: string
): { ok: true; session: SesionAutenticada; requiereCambioPassword: boolean } | { ok: false; code: string; message: string } {
  limpiarSesionesExpiradas();
  const auth = autenticarUsuario(identificador, password);
  if (!auth.ok) {
    return auth;
  }

  const emitidaEn = new Date().toISOString();
  const expiraEn = new Date(Date.now() + SESSION_TTL_MS).toISOString();
  const registro: RegistroSesion = {
    token: randomUUID(),
    usuarioId: auth.user.usuarioId,
    emitidaEn,
    expiraEn
  };
  sesiones.set(registro.token, registro);
  return {
    ok: true,
    session: construirSesion(auth.user, registro),
    requiereCambioPassword: auth.user.requiereCambioPassword ?? false
  };
}

export function obtenerSesionPorToken(token: string): SesionAutenticada | null {
  limpiarSesionesExpiradas();
  const normalized = token.trim();
  if (!normalized) return null;
  const registro = sesiones.get(normalized);
  if (!registro) return null;
  const user = obtenerUsuario(registro.usuarioId);
  if (!user || !user.activo) {
    sesiones.delete(normalized);
    return null;
  }
  return construirSesion(user, registro);
}

export function invalidarSesion(token: string): boolean {
  return sesiones.delete(token.trim());
}

export function extraerTokenBearer(
  authorizationHeader?: string | null
): string | null {
  const raw = authorizationHeader?.trim();
  if (!raw) return null;
  const [scheme, token] = raw.split(/\s+/, 2);
  if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
    return null;
  }
  return token.trim();
}
