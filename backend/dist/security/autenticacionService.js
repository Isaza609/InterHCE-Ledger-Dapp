"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.iniciarSesion = iniciarSesion;
exports.obtenerSesionPorToken = obtenerSesionPorToken;
exports.invalidarSesion = invalidarSesion;
exports.extraerTokenBearer = extraerTokenBearer;
const crypto_1 = require("crypto");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const sesiones = new Map();
function limpiarSesionesExpiradas() {
    const now = Date.now();
    for (const [token, sesion] of sesiones.entries()) {
        if (Date.parse(sesion.expiraEn) <= now) {
            sesiones.delete(token);
        }
    }
}
function construirSesion(user, registro) {
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
function iniciarSesion(identificador, password) {
    limpiarSesionesExpiradas();
    const auth = (0, accesoUsuariosService_1.autenticarUsuario)(identificador, password);
    if (!auth.ok) {
        return auth;
    }
    const emitidaEn = new Date().toISOString();
    const expiraEn = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    const registro = {
        token: (0, crypto_1.randomUUID)(),
        usuarioId: auth.user.usuarioId,
        emitidaEn,
        expiraEn
    };
    sesiones.set(registro.token, registro);
    return {
        ok: true,
        session: construirSesion(auth.user, registro)
    };
}
function obtenerSesionPorToken(token) {
    limpiarSesionesExpiradas();
    const normalized = token.trim();
    if (!normalized)
        return null;
    const registro = sesiones.get(normalized);
    if (!registro)
        return null;
    const user = (0, accesoUsuariosService_1.obtenerUsuario)(registro.usuarioId);
    if (!user || !user.activo) {
        sesiones.delete(normalized);
        return null;
    }
    return construirSesion(user, registro);
}
function invalidarSesion(token) {
    return sesiones.delete(token.trim());
}
function extraerTokenBearer(authorizationHeader) {
    const raw = authorizationHeader?.trim();
    if (!raw)
        return null;
    const [scheme, token] = raw.split(/\s+/, 2);
    if (!scheme || scheme.toLowerCase() !== "bearer" || !token) {
        return null;
    }
    return token.trim();
}
