"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accessRouter = void 0;
const express_1 = require("express");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
const autorizacionService_1 = require("../security/autorizacionService");
exports.accessRouter = (0, express_1.Router)();
exports.accessRouter.get("/roles", (_req, res) => {
    return res.status(200).json({
        code: "OK",
        roles: (0, accesoUsuariosService_1.listarRolesSistema)()
    });
});
exports.accessRouter.get("/capabilities", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(400).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar x-user-role válido para consultar capacidades."
        });
    }
    return res.status(200).json({
        code: "OK",
        role: actor.rol,
        capabilities: (0, accesoUsuariosService_1.obtenerCapacidadesRol)(actor.rol)
    });
});
exports.accessRouter.get("/roles-creables", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido."
        });
    }
    return res.status(200).json({
        code: "OK",
        rolesCreables: (0, accesoUsuariosService_1.rolesCreablesPor)(actor)
    });
});
exports.accessRouter.get("/users", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido para consultar usuarios."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    if (!(0, accesoUsuariosService_1.actorPuedeGestionarUsuarios)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo admin_ips o super_admin puede consultar y gestionar usuarios."
        });
    }
    if (actor.rol === "super_admin") {
        const ipsFilter = req.query.ipsId ? String(req.query.ipsId).trim() : null;
        const users = ipsFilter
            ? (0, accesoUsuariosService_1.listarUsuariosPorIps)(ipsFilter)
            : (0, accesoUsuariosService_1.listarTodosUsuarios)();
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
        users: (0, accesoUsuariosService_1.listarUsuariosPorIps)(actor.ipsId)
    });
});
exports.accessRouter.get("/users/:id", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido."
        });
    }
    if (!(0, accesoUsuariosService_1.actorPuedeGestionarUsuarios)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo admin_ips o super_admin puede consultar usuarios."
        });
    }
    const user = (0, accesoUsuariosService_1.obtenerUsuario)(req.params.id);
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
exports.accessRouter.post("/users", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido para crear usuarios."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    if (!(0, accesoUsuariosService_1.actorPuedeGestionarUsuarios)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo admin_ips o super_admin puede crear usuarios."
        });
    }
    const targetIpsId = actor.rol === "super_admin"
        ? String(req.body?.ipsId ?? "").trim()
        : (actor.ipsId ?? "");
    const result = (0, accesoUsuariosService_1.crearUsuarioIps)({
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
exports.accessRouter.patch("/users/:id", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido para actualizar usuarios."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    if (!(0, accesoUsuariosService_1.actorPuedeGestionarUsuarios)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo admin_ips o super_admin puede actualizar usuarios."
        });
    }
    const target = (0, accesoUsuariosService_1.obtenerUsuario)(req.params.id);
    if (target && actor.rol === "admin_ips" && target.ipsId !== actor.ipsId) {
        return res.status(403).json({
            code: "IPS_SCOPE_VIOLATION",
            message: "No puede modificar usuarios de otra IPS."
        });
    }
    const result = (0, accesoUsuariosService_1.actualizarUsuarioIps)(req.params.id, {
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
exports.accessRouter.post("/users/:id/reset-password", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido."
        });
    }
    if (!(0, accesoUsuariosService_1.actorPuedeGestionarUsuarios)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo admin_ips o super_admin puede resetear contraseñas."
        });
    }
    const target = (0, accesoUsuariosService_1.obtenerUsuario)(req.params.id);
    if (target && actor.rol === "admin_ips" && target.ipsId !== actor.ipsId) {
        return res.status(403).json({
            code: "IPS_SCOPE_VIOLATION",
            message: "No puede resetear contraseñas de usuarios de otra IPS."
        });
    }
    const result = (0, accesoUsuariosService_1.resetearPassword)(req.params.id, req.body?.password);
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
exports.accessRouter.post("/patients/sync-from-episodes", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar actor válido."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({ code: userCheck.code, message: userCheck.message });
    }
    if (!(0, accesoUsuariosService_1.actorPuedeGestionarUsuarios)(actor)) {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo admin_ips o super_admin puede ejecutar la sincronización."
        });
    }
    let filtroIps;
    if (actor.rol === "admin_ips") {
        filtroIps = actor.ipsId?.trim();
        if (!filtroIps) {
            return res.status(400).json({
                code: "MISSING_IPS",
                message: "El administrador IPS debe tener x-ips-id para sincronizar sus episodios."
            });
        }
    }
    else {
        const raw = req.body?.ipsId;
        filtroIps = typeof raw === "string" && raw.trim() ? raw.trim() : undefined;
    }
    try {
        const data = await (0, accesoUsuariosService_1.sincronizarUsuariosPacienteDesdeEpisodiosExistentes)(filtroIps);
        return res.status(200).json({
            code: "PATIENT_USERS_SYNCED",
            message: `Revisados ${data.episodiosRevisados} episodios: ${data.usuariosCreados} usuarios paciente creados, ` +
                `${data.yaTenianUsuario} ya existían, ${data.sinDocumentoPaciente} sin documento en el episodio.`,
            data
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Error al sincronizar.";
        return res.status(500).json({
            code: "SYNC_ERROR",
            message
        });
    }
});
