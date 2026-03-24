"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.obtenerActorDesdeRequest = obtenerActorDesdeRequest;
exports.rolPuedeCrearOActualizar = rolPuedeCrearOActualizar;
exports.validarAccesoOperacionClinica = validarAccesoOperacionClinica;
const autenticacionService_1 = require("./autenticacionService");
const ROLES_VALIDOS = [
    "profesional_salud",
    "admin_ips",
    "paciente",
    "auditor",
    "super_admin"
];
function obtenerActorDesdeRequest(req) {
    const token = (0, autenticacionService_1.extraerTokenBearer)(req.header("authorization"));
    if (token) {
        const sesion = (0, autenticacionService_1.obtenerSesionPorToken)(token);
        if (sesion) {
            return {
                rol: sesion.rol,
                ipsId: sesion.ipsId,
                usuarioId: sesion.usuarioId
            };
        }
    }
    const rawRol = req.header("x-user-role")?.trim().toLowerCase();
    if (!rawRol || !ROLES_VALIDOS.includes(rawRol)) {
        return null;
    }
    const rol = rawRol;
    const ipsId = req.header("x-ips-id")?.trim();
    const usuarioId = req.header("x-user-id")?.trim();
    return { rol, ipsId, usuarioId };
}
function rolPuedeCrearOActualizar(actor) {
    return actor.rol === "profesional_salud" || actor.rol === "admin_ips";
}
function validarAccesoOperacionClinica(actor) {
    if (!actor) {
        return {
            ok: false,
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar x-user-role con un rol válido (profesional_salud, admin_ips, paciente, auditor)."
        };
    }
    if (!rolPuedeCrearOActualizar(actor)) {
        return {
            ok: false,
            code: "FORBIDDEN_ROLE",
            message: "El rol actual no tiene permisos para crear o actualizar episodios clínicos."
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
