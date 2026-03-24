import type { Request } from "express";
import type { ActorContexto, RolUsuario } from "../hce/episodioLifecycleService";
import { extraerTokenBearer, obtenerSesionPorToken } from "./autenticacionService";

const ROLES_VALIDOS: RolUsuario[] = [
  "profesional_salud",
  "admin_ips",
  "paciente",
  "auditor",
  "super_admin"
];

export function obtenerActorDesdeRequest(req: Request): ActorContexto | null {
  const token = extraerTokenBearer(req.header("authorization"));
  if (token) {
    const sesion = obtenerSesionPorToken(token);
    if (sesion) {
      return {
        rol: sesion.rol,
        ipsId: sesion.ipsId,
        usuarioId: sesion.usuarioId
      };
    }
  }
  const rawRol = req.header("x-user-role")?.trim().toLowerCase();
  if (!rawRol || !ROLES_VALIDOS.includes(rawRol as RolUsuario)) {
    return null;
  }
  const rol = rawRol as RolUsuario;
  const ipsId = req.header("x-ips-id")?.trim();
  const usuarioId = req.header("x-user-id")?.trim();
  return { rol, ipsId, usuarioId };
}

export function rolPuedeCrearOActualizar(actor: ActorContexto): boolean {
  return actor.rol === "profesional_salud" || actor.rol === "admin_ips";
}

export function validarAccesoOperacionClinica(
  actor: ActorContexto | null
): { ok: true } | { ok: false; code: string; message: string } {
  if (!actor) {
    return {
      ok: false,
      code: "MISSING_OR_INVALID_ROLE",
      message:
        "Debe enviar x-user-role con un rol válido (profesional_salud, admin_ips, paciente, auditor)."
    };
  }
  if (!rolPuedeCrearOActualizar(actor)) {
    return {
      ok: false,
      code: "FORBIDDEN_ROLE",
      message:
        "El rol actual no tiene permisos para crear o actualizar episodios clínicos."
    };
  }
  if (!actor.ipsId) {
    return {
      ok: false,
      code: "MISSING_IPS",
      message: "Debe enviar x-ips-id para operaciones clínicas de creación/actualización."
    };
  }
  return { ok: true };
}
