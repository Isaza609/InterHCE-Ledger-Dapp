"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ipsRouter = void 0;
const express_1 = require("express");
const ipsService_1 = require("../ips/ipsService");
const autorizacionService_1 = require("../security/autorizacionService");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
exports.ipsRouter = (0, express_1.Router)();
exports.ipsRouter.get("/", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (actor && (0, ipsService_1.actorPuedeGestionarIps)(actor)) {
        return res.status(200).json({ code: "OK", ips: (0, ipsService_1.listarIps)() });
    }
    return res.status(200).json({ code: "OK", ips: (0, ipsService_1.listarIpsActivas)() });
});
exports.ipsRouter.get("/:id", (req, res) => {
    const ips = (0, ipsService_1.obtenerIps)(req.params.id);
    if (!ips) {
        return res.status(404).json({ code: "IPS_NOT_FOUND", message: "IPS no encontrada." });
    }
    return res.status(200).json({ code: "OK", ips });
});
exports.ipsRouter.post("/", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido para crear IPS."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({ code: userCheck.code, message: userCheck.message });
    }
    if (!(0, ipsService_1.actorPuedeGestionarIps)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo super_admin puede crear IPS."
        });
    }
    const result = (0, ipsService_1.crearIps)({
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
exports.ipsRouter.patch("/:id", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido para actualizar IPS."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({ code: userCheck.code, message: userCheck.message });
    }
    if (!(0, ipsService_1.actorPuedeGestionarIps)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo super_admin puede actualizar IPS."
        });
    }
    const result = (0, ipsService_1.actualizarIps)(req.params.id, {
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
