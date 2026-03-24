import { createHash } from "crypto";
import type { ActorContexto, RolUsuario } from "../hce/episodioLifecycleService";
import { existeIps } from "../ips/ipsService";

export interface UsuarioIps {
  usuarioId: string;
  nombre: string;
  correo: string;
  passwordHash: string;
  rol: RolUsuario;
  ipsId: string;
  activo: boolean;
  documentoIdentidad?: string;
  requiereCambioPassword: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

const CAPABILIDADES_POR_ROL: Record<RolUsuario, string[]> = {
  super_admin: [
    "ips.crear",
    "ips.actualizar",
    "ips.listar",
    "ips.usuarios.gestionar",
    "ips.permisos.gestionar",
    "episodios.consultar",
    "episodios.documento.ver",
    "sistema.configurar",
    "trazabilidad.consultar"
  ],
  profesional_salud: [
    "episodios.crear",
    "episodios.actualizar",
    "episodios.consultar",
    "episodios.documento.ver",
    "trazabilidad.consultar"
  ],
  admin_ips: [
    "episodios.crear",
    "episodios.actualizar",
    "episodios.consultar",
    "episodios.documento.ver",
    "ips.usuarios.gestionar",
    "ips.permisos.gestionar",
    "trazabilidad.consultar"
  ],
  paciente: ["episodios.consultar"],
  auditor: ["trazabilidad.consultar", "evaluacion.consultar"]
};

const ROLES_CREABLES_POR: Record<RolUsuario, RolUsuario[]> = {
  super_admin: ["admin_ips", "profesional_salud", "paciente", "auditor"],
  admin_ips: ["profesional_salud", "paciente"],
  profesional_salud: [],
  paciente: [],
  auditor: []
};

const usuariosStore = new Map<string, UsuarioIps>();

function nowIso(): string {
  return new Date().toISOString();
}

function normalizarCorreo(value: string): string {
  return value.trim().toLowerCase();
}

export function crearPasswordHash(password: string): string {
  return createHash("sha256").update(password, "utf8").digest("hex");
}

function buildCorreoPorDefecto(usuarioId: string, ipsId: string): string {
  const scope = ipsId.trim().toLowerCase() || "sistema";
  return `${usuarioId.trim().toLowerCase()}@${scope}.interhce.local`;
}

function seedUsuariosIniciales() {
  const base: UsuarioIps[] = [
    {
      usuarioId: "super-admin-001",
      nombre: "Super Administrador",
      correo: "superadmin@interhce.local",
      passwordHash: crearPasswordHash("SuperAdmin001!"),
      rol: "super_admin",
      ipsId: "SISTEMA",
      activo: true,
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    },
    {
      usuarioId: "admin-ips-001",
      nombre: "Administrador IPS 001",
      correo: "admin.ips001@interhce.local",
      passwordHash: crearPasswordHash("AdminIPS001!"),
      rol: "admin_ips",
      ipsId: "IPS-001",
      activo: true,
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    },
    {
      usuarioId: "profesional-001",
      nombre: "Profesional IPS 001",
      correo: "profesional.ips001@interhce.local",
      passwordHash: crearPasswordHash("Profesional001!"),
      rol: "profesional_salud",
      ipsId: "IPS-001",
      activo: true,
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    },
    {
      usuarioId: "admin-ips-002",
      nombre: "Administrador IPS 002",
      correo: "admin.ips002@interhce.local",
      passwordHash: crearPasswordHash("AdminIPS002!"),
      rol: "admin_ips",
      ipsId: "IPS-002",
      activo: true,
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    },
    {
      usuarioId: "profesional-002",
      nombre: "Profesional IPS 002",
      correo: "profesional.ips002@interhce.local",
      passwordHash: crearPasswordHash("Profesional002!"),
      rol: "profesional_salud",
      ipsId: "IPS-002",
      activo: true,
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    },
    {
      usuarioId: "auditor-001",
      nombre: "Auditor clínico",
      correo: "auditor@interhce.local",
      passwordHash: crearPasswordHash("Auditor001!"),
      rol: "auditor",
      ipsId: "AUDITORIA",
      activo: true,
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    },
    {
      usuarioId: "paciente-001",
      nombre: "Paciente de prueba",
      correo: "paciente@interhce.local",
      passwordHash: crearPasswordHash("Paciente001!"),
      rol: "paciente",
      ipsId: "PACIENTE",
      activo: true,
      documentoIdentidad: "1234567890",
      requiereCambioPassword: false,
      creadoEn: nowIso(),
      actualizadoEn: nowIso()
    }
  ];
  for (const item of base) {
    if (!usuariosStore.has(item.usuarioId)) {
      usuariosStore.set(item.usuarioId, item);
    }
  }
}

seedUsuariosIniciales();

export function listarRolesSistema() {
  return Object.entries(CAPABILIDADES_POR_ROL).map(([rol, capacidades]) => ({
    rol,
    capacidades
  }));
}

export function obtenerCapacidadesRol(rol: RolUsuario): string[] {
  return CAPABILIDADES_POR_ROL[rol] ?? [];
}

export function listarUsuariosPorIps(ipsId: string): UsuarioIps[] {
  return [...usuariosStore.values()].filter((item) => item.ipsId === ipsId);
}

export function listarTodosUsuarios(): UsuarioIps[] {
  return [...usuariosStore.values()];
}

export function rolesCreablesPor(actor: ActorContexto): RolUsuario[] {
  return ROLES_CREABLES_POR[actor.rol] ?? [];
}

export function crearUsuarioIps(input: {
  usuarioId: string;
  nombre: string;
  correo?: string;
  password?: string;
  rol: RolUsuario;
  ipsId: string;
  documentoIdentidad?: string;
}, actor?: ActorContexto): { ok: true; user: UsuarioIps } | { ok: false; code: string; message: string } {
  const usuarioId = input.usuarioId.trim();
  const nombre = input.nombre.trim();
  const ipsId = input.ipsId.trim();
  if (!usuarioId || !nombre || !ipsId) {
    return { ok: false, code: "MISSING_FIELDS", message: "usuarioId, nombre e ipsId son obligatorios." };
  }
  if (usuariosStore.has(usuarioId)) {
    return { ok: false, code: "USER_EXISTS", message: "Ya existe un usuario con ese usuarioId." };
  }

  if (actor) {
    const permitidos = ROLES_CREABLES_POR[actor.rol] ?? [];
    if (!permitidos.includes(input.rol)) {
      return {
        ok: false,
        code: "ROLE_NOT_ALLOWED",
        message: `El rol ${actor.rol} no puede crear usuarios con rol ${input.rol}.`
      };
    }
    if (actor.rol === "admin_ips" && actor.ipsId !== ipsId) {
      return {
        ok: false,
        code: "IPS_SCOPE_VIOLATION",
        message: "El admin_ips solo puede crear usuarios dentro de su propia IPS."
      };
    }
  }

  const ipsEspeciales = ["SISTEMA", "AUDITORIA", "PACIENTE"];
  if (!ipsEspeciales.includes(ipsId) && !existeIps(ipsId)) {
    return { ok: false, code: "IPS_NOT_FOUND", message: `La IPS '${ipsId}' no existe en el sistema.` };
  }

  if (input.documentoIdentidad?.trim()) {
    const existing = buscarUsuarioPorDocumento(input.documentoIdentidad.trim());
    if (existing) {
      return { ok: false, code: "DOCUMENT_EXISTS", message: "Ya existe un usuario con ese documento de identidad." };
    }
  }

  const passwordRaw = input.password?.trim() || `Temporal-${usuarioId}`;
  const user: UsuarioIps = {
    usuarioId,
    nombre,
    correo: input.correo?.trim() || buildCorreoPorDefecto(usuarioId, ipsId),
    passwordHash: crearPasswordHash(passwordRaw),
    rol: input.rol,
    ipsId,
    activo: true,
    documentoIdentidad: input.documentoIdentidad?.trim() || undefined,
    requiereCambioPassword: !input.password,
    creadoEn: nowIso(),
    actualizadoEn: nowIso()
  };
  usuariosStore.set(usuarioId, user);
  return { ok: true, user };
}

export function actualizarUsuarioIps(
  usuarioId: string,
  patch: {
    nombre?: string;
    rol?: RolUsuario;
    activo?: boolean;
  }
): { ok: true; user: UsuarioIps } | { ok: false; message: string } {
  const found = usuariosStore.get(usuarioId);
  if (!found) {
    return { ok: false, message: "Usuario no encontrado." };
  }
  const updated: UsuarioIps = {
    ...found,
    nombre: patch.nombre?.trim() || found.nombre,
    rol: patch.rol ?? found.rol,
    activo: patch.activo ?? found.activo,
    actualizadoEn: nowIso()
  };
  usuariosStore.set(usuarioId, updated);
  return { ok: true, user: updated };
}

export function cambiarPassword(
  usuarioId: string,
  passwordActual: string,
  passwordNueva: string
): { ok: true } | { ok: false; code: string; message: string } {
  const user = usuariosStore.get(usuarioId);
  if (!user) {
    return { ok: false, code: "USER_NOT_FOUND", message: "Usuario no encontrado." };
  }
  if (user.passwordHash !== crearPasswordHash(passwordActual)) {
    return { ok: false, code: "INVALID_PASSWORD", message: "La contraseña actual es incorrecta." };
  }
  if (passwordNueva.length < 6) {
    return { ok: false, code: "WEAK_PASSWORD", message: "La nueva contraseña debe tener al menos 6 caracteres." };
  }
  user.passwordHash = crearPasswordHash(passwordNueva);
  user.requiereCambioPassword = false;
  user.actualizadoEn = nowIso();
  usuariosStore.set(usuarioId, user);
  return { ok: true };
}

export function resetearPassword(
  usuarioId: string,
  nuevaPassword?: string
): { ok: true; passwordTemporal: string } | { ok: false; code: string; message: string } {
  const user = usuariosStore.get(usuarioId);
  if (!user) {
    return { ok: false, code: "USER_NOT_FOUND", message: "Usuario no encontrado." };
  }
  const passwordTemporal = nuevaPassword?.trim() || `Reset-${usuarioId}-${Date.now().toString(36)}`;
  user.passwordHash = crearPasswordHash(passwordTemporal);
  user.requiereCambioPassword = true;
  user.actualizadoEn = nowIso();
  usuariosStore.set(usuarioId, user);
  return { ok: true, passwordTemporal };
}

export function obtenerUsuario(usuarioId: string): UsuarioIps | undefined {
  return usuariosStore.get(usuarioId);
}

export function buscarUsuarioPorDocumento(
  documento: string
): UsuarioIps | undefined {
  const normalized = documento.trim();
  if (!normalized) return undefined;
  return [...usuariosStore.values()].find(
    (item) => item.documentoIdentidad === normalized
  );
}

export function buscarUsuarioPorIdentificador(
  identificador: string
): UsuarioIps | undefined {
  const normalized = identificador.trim().toLowerCase();
  if (!normalized) return undefined;
  const byId = usuariosStore.get(identificador.trim());
  if (byId) return byId;
  const byEmail = [...usuariosStore.values()].find(
    (item) => normalizarCorreo(item.correo) === normalized
  );
  if (byEmail) return byEmail;
  return [...usuariosStore.values()].find(
    (item) => item.documentoIdentidad === identificador.trim()
  );
}

export function autenticarUsuario(
  identificador: string,
  password: string
): { ok: true; user: UsuarioIps } | { ok: false; code: string; message: string } {
  const user = buscarUsuarioPorIdentificador(identificador);
  if (!user) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Credenciales inválidas."
    };
  }
  if (!user.activo) {
    return {
      ok: false,
      code: "USER_INACTIVE",
      message: "El usuario está inactivo y no puede autenticarse."
    };
  }
  if (user.passwordHash !== crearPasswordHash(password)) {
    return {
      ok: false,
      code: "INVALID_CREDENTIALS",
      message: "Credenciales inválidas."
    };
  }
  return { ok: true, user };
}

export function validarActorContraUsuarios(
  actor: ActorContexto
): { ok: true } | { ok: false; code: string; message: string } {
  if (!actor.usuarioId) {
    return { ok: true };
  }
  const user = obtenerUsuario(actor.usuarioId);
  if (!user) {
    return {
      ok: false,
      code: "USER_NOT_REGISTERED",
      message: "El usuario no está registrado dentro de una IPS."
    };
  }
  if (!user.activo) {
    return {
      ok: false,
      code: "USER_INACTIVE",
      message: "El usuario está inactivo y no puede operar en el sistema."
    };
  }
  if (user.rol !== actor.rol) {
    return {
      ok: false,
      code: "ROLE_MISMATCH",
      message: "El rol informado no coincide con el rol asignado al usuario."
    };
  }
  if (user.ipsId !== actor.ipsId) {
    return {
      ok: false,
      code: "IPS_MISMATCH",
      message: "La IPS del actor no coincide con la IPS del usuario registrado."
    };
  }
  return { ok: true };
}

export function actorPuedeGestionarUsuarios(actor: ActorContexto): boolean {
  return actor.rol === "admin_ips" || actor.rol === "super_admin";
}
