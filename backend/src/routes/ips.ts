import { Router } from "express";
import {
  actorPuedeGestionarIps,
  actualizarIps,
  crearIps,
  listarIps,
  listarIpsActivas,
  obtenerIps
} from "../ips/ipsService";
import { obtenerActorDesdeRequest } from "../security/autorizacionService";
import { validarActorContraUsuarios } from "../access/accesoUsuariosService";

export const ipsRouter = Router();

ipsRouter.get("/", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (actor && actorPuedeGestionarIps(actor)) {
    return res.status(200).json({ code: "OK", ips: listarIps() });
  }
  return res.status(200).json({ code: "OK", ips: listarIpsActivas() });
});

ipsRouter.get("/:id", (req, res) => {
  const ips = obtenerIps(req.params.id);
  if (!ips) {
    return res.status(404).json({ code: "IPS_NOT_FOUND", message: "IPS no encontrada." });
  }
  return res.status(200).json({ code: "OK", ips });
});

ipsRouter.post("/", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido para crear IPS."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({ code: userCheck.code, message: userCheck.message });
  }
  if (!actorPuedeGestionarIps(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo super_admin puede crear IPS."
    });
  }
  const result = crearIps({
    ipsId: String(req.body?.ipsId ?? ""),
    nombre: String(req.body?.nombre ?? ""),
    repsCodigo: String(req.body?.repsCodigo ?? ""),
    direccion: req.body?.direccion,
    ciudad: req.body?.ciudad,
    departamento: req.body?.departamento,
    telefono: req.body?.telefono,
    correoContacto: req.body?.correoContacto
  });
  if (!result.ok) {
    return res.status(400).json({ code: "IPS_CREATE_ERROR", message: result.message });
  }
  return res.status(201).json({ code: "IPS_CREATED", message: "IPS creada exitosamente.", ips: result.ips });
});

ipsRouter.patch("/:id", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar actor válido para actualizar IPS."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({ code: userCheck.code, message: userCheck.message });
  }
  if (!actorPuedeGestionarIps(actor)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo super_admin puede actualizar IPS."
    });
  }
  const result = actualizarIps(req.params.id, {
    nombre: req.body?.nombre,
    repsCodigo: req.body?.repsCodigo,
    direccion: req.body?.direccion,
    ciudad: req.body?.ciudad,
    departamento: req.body?.departamento,
    telefono: req.body?.telefono,
    correoContacto: req.body?.correoContacto,
    activa: typeof req.body?.activa === "boolean" ? req.body.activa : undefined
  });
  if (!result.ok) {
    return res.status(404).json({ code: "IPS_UPDATE_ERROR", message: result.message });
  }
  return res.status(200).json({ code: "IPS_UPDATED", message: "IPS actualizada.", ips: result.ips });
});
