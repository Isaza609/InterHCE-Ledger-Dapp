import { Router } from "express";
import {
  actorPuedeGestionarUsuarios,
  actualizarUsuarioIps,
  crearUsuarioIps,
  listarRolesSistema,
  listarUsuariosPorIps,
  obtenerCapacidadesRol,
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
  if (!actor.ipsId) {
    return res.status(400).json({
      code: "MISSING_IPS",
      message: "Debe enviar x-ips-id."
    });
  }
  if (!actorPuedeGestionarUsuarios(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips puede consultar y gestionar usuarios de su IPS."
    });
  }
  return res.status(200).json({
    code: "OK",
    ipsId: actor.ipsId,
    users: listarUsuariosPorIps(actor.ipsId)
  });
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
      message: "Solo admin_ips puede crear usuarios dentro de su IPS."
    });
  }
  const result = crearUsuarioIps({
    usuarioId: String(req.body?.usuarioId ?? ""),
    nombre: String(req.body?.nombre ?? ""),
    rol: req.body?.rol,
    ipsId: actor.ipsId ?? ""
  });
  if (!result.ok) {
    return res.status(400).json({
      code: "USER_CREATE_ERROR",
      message: result.message
    });
  }
  return res.status(201).json({
    code: "USER_CREATED",
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
      message: "Solo admin_ips puede actualizar usuarios dentro de su IPS."
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
    user: result.user
  });
});
