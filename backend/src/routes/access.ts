import { Router } from "express";
import {
  actorPuedeGestionarUsuarios,
  actualizarUsuarioIps,
  crearUsuarioIps,
  listarRolesSistema,
  listarUsuariosPorIps,
  listarTodosUsuarios,
  obtenerCapacidadesRol,
  obtenerUsuario,
  resetearPassword,
  rolesCreablesPor,
  sincronizarUsuariosPacienteDesdeEpisodiosExistentes,
  validarActorContraUsuarios
} from "../access/accesoUsuariosService";
import { obtenerActorDesdeRequest } from "../security/autorizacionService";

export const accessRouter = Router();

accessRouter.get("/roles", (_req, res) => {
  return res.status(200).json({
    code: "OK",
    roles: listarRolesSistema()
  });
});

accessRouter.get("/capabilities", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(400).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar x-user-role válido para consultar capacidades."
    });
  }
  return res.status(200).json({
    code: "OK",
    role: actor.rol,
    capabilities: obtenerCapacidadesRol(actor.rol)
  });
});

accessRouter.get("/roles-creables", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido."
    });
  }
  return res.status(200).json({
    code: "OK",
    rolesCreables: rolesCreablesPor(actor)
  });
});

accessRouter.get("/users", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido para consultar usuarios."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips o super_admin puede consultar y gestionar usuarios."
    });
  }

  if (actor.rol === "super_admin") {
    const ipsFilter = req.query.ipsId ? String(req.query.ipsId).trim() : null;
    const users = ipsFilter
      ? listarUsuariosPorIps(ipsFilter)
      : listarTodosUsuarios();
    return res.status(200).json({ code: "OK", users });
  }

  if (!actor.ipsId) {
    return res.status(400).json({
      code: "MISSING_IPS",
      message: "Debe enviar x-ips-id."
    });
  }
  return res.status(200).json({
    code: "OK",
    ipsId: actor.ipsId,
    users: listarUsuariosPorIps(actor.ipsId)
  });
});

accessRouter.get("/users/:id", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido."
    });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips o super_admin puede consultar usuarios."
    });
  }
  const user = obtenerUsuario(req.params.id);
  if (!user) {
    return res.status(404).json({ code: "USER_NOT_FOUND", message: "Usuario no encontrado." });
  }
  if (actor.rol === "admin_ips" && user.ipsId !== actor.ipsId) {
    return res.status(403).json({
      code: "IPS_SCOPE_VIOLATION",
      message: "No puede consultar usuarios de otra IPS."
    });
  }
  return res.status(200).json({ code: "OK", user });
});

accessRouter.post("/users", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido para crear usuarios."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips o super_admin puede crear usuarios."
    });
  }

  const targetIpsId = actor.rol === "super_admin"
    ? String(req.body?.ipsId ?? "").trim()
    : (actor.ipsId ?? "");

  const result = crearUsuarioIps({
    usuarioId: String(req.body?.usuarioId ?? ""),
    nombre: String(req.body?.nombre ?? ""),
    correo: req.body?.correo,
    password: req.body?.password,
    rol: req.body?.rol,
    ipsId: targetIpsId,
    documentoIdentidad: req.body?.documentoIdentidad
  }, actor);

  if (!result.ok) {
    return res.status(400).json({
      code: result.code,
      message: result.message
    });
  }
  return res.status(201).json({
    code: "USER_CREATED",
    message: "Usuario creado exitosamente.",
    user: result.user
  });
});

accessRouter.patch("/users/:id", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido para actualizar usuarios."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips o super_admin puede actualizar usuarios."
    });
  }

  const target = obtenerUsuario(req.params.id);
  if (target && actor.rol === "admin_ips" && target.ipsId !== actor.ipsId) {
    return res.status(403).json({
      code: "IPS_SCOPE_VIOLATION",
      message: "No puede modificar usuarios de otra IPS."
    });
  }

  const result = actualizarUsuarioIps(req.params.id, {
    nombre: req.body?.nombre,
    rol: req.body?.rol,
    activo: typeof req.body?.activo === "boolean" ? req.body.activo : undefined
  });
  if (!result.ok) {
    return res.status(404).json({
      code: "USER_UPDATE_ERROR",
      message: result.message
    });
  }
  return res.status(200).json({
    code: "USER_UPDATED",
    message: "Usuario actualizado.",
    user: result.user
  });
});

accessRouter.post("/users/:id/reset-password", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido."
    });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips o super_admin puede resetear contraseñas."
    });
  }

  const target = obtenerUsuario(req.params.id);
  if (target && actor.rol === "admin_ips" && target.ipsId !== actor.ipsId) {
    return res.status(403).json({
      code: "IPS_SCOPE_VIOLATION",
      message: "No puede resetear contraseñas de usuarios de otra IPS."
    });
  }

  const result = resetearPassword(req.params.id, req.body?.password);
  if (!result.ok) {
    return res.status(404).json({ code: result.code, message: result.message });
  }
  return res.status(200).json({
    code: "PASSWORD_RESET",
    message: "Contraseña reseteada.",
    passwordTemporal: result.passwordTemporal
  });
});

/**
 * Crea usuarios rol paciente faltantes a partir de episodios ya guardados (retrocompatibilidad).
 * - admin_ips: solo episodios cuya IPS origen es la suya.
 * - super_admin: todos los episodios, o filtrar con body.ipsId opcional.
 */
accessRouter.post("/patients/sync-from-episodes", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({ code: userCheck.code, message: userCheck.message });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips o super_admin puede ejecutar la sincronización."
    });
  }

  let filtroIps: string | undefined;
  if (actor.rol === "admin_ips") {
    filtroIps = actor.ipsId?.trim();
    if (!filtroIps) {
      return res.status(400).json({
        code: "MISSING_IPS",
        message: "El administrador IPS debe tener x-ips-id para sincronizar sus episodios."
      });
    }
  } else {
    const raw = req.body?.ipsId;
    filtroIps = typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
  }

  try {
    const data = await sincronizarUsuariosPacienteDesdeEpisodiosExistentes(filtroIps);
    return res.status(200).json({
      code: "PATIENT_USERS_SYNCED",
      message:
        `Revisados ${data.episodiosRevisados} episodios: ${data.usuariosCreados} usuarios paciente creados, ` +
        `${data.yaTenianUsuario} ya existían, ${data.sinDocumentoPaciente} sin documento en el episodio.`,
      data
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al sincronizar.";
    return res.status(500).json({
      code: "SYNC_ERROR",
      message
    });
  }
});
