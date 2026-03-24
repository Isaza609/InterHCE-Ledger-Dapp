"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const autenticacionService_1 = require("../security/autenticacionService");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/login", (req, res) => {
    const identificador = String(req.body?.correo ?? req.body?.usuarioId ?? req.body?.documentoIdentidad ?? "").trim();
    const password = String(req.body?.password ?? "").trim();
    if (!identificador || !password) {
        return res.status(400).json({
            code: "MISSING_CREDENTIALS",
            message: "Debe enviar correo, usuarioId o documentoIdentidad, junto con password."
        });
    }
    const result = (0, autenticacionService_1.iniciarSesion)(identificador, password);
    if (!result.ok) {
        return res.status(result.code === "USER_INACTIVE" ? 403 : 401).json({
            code: result.code,
            message: result.message
        });
    }
    return res.status(200).json({
        code: "AUTHENTICATED",
        message: "Sesión iniciada correctamente.",
        session: result.session,
        requiereCambioPassword: result.requiereCambioPassword ?? false
    });
});
exports.authRouter.get("/me", (req, res) => {
    const token = (0, autenticacionService_1.extraerTokenBearer)(req.header("authorization"));
    if (!token) {
        return res.status(401).json({
            code: "UNAUTHENTICATED",
            message: "Debe enviar Authorization: Bearer <token>."
        });
    }
    const session = (0, autenticacionService_1.obtenerSesionPorToken)(token);
    if (!session) {
        return res.status(401).json({
            code: "INVALID_SESSION",
            message: "La sesión no existe o expiró."
        });
    }
    return res.status(200).json({
        code: "OK",
        session
    });
});
exports.authRouter.post("/logout", (req, res) => {
    const token = (0, autenticacionService_1.extraerTokenBearer)(req.header("authorization"));
    if (!token) {
        return res.status(400).json({
            code: "MISSING_TOKEN",
            message: "Debe enviar Authorization: Bearer <token>."
        });
    }
    (0, autenticacionService_1.invalidarSesion)(token);
    return res.status(200).json({
        code: "SESSION_CLOSED",
        message: "La sesión fue invalidada."
    });
});
exports.authRouter.patch("/password", (req, res) => {
    const token = (0, autenticacionService_1.extraerTokenBearer)(req.header("authorization"));
    if (!token) {
        return res.status(401).json({
            code: "UNAUTHENTICATED",
            message: "Debe enviar Authorization: Bearer <token>."
        });
    }
    const session = (0, autenticacionService_1.obtenerSesionPorToken)(token);
    if (!session) {
        return res.status(401).json({
            code: "INVALID_SESSION",
            message: "La sesión no existe o expiró."
        });
    }
    const passwordActual = String(req.body?.passwordActual ?? "").trim();
    const passwordNueva = String(req.body?.passwordNueva ?? "").trim();
    if (!passwordActual || !passwordNueva) {
        return res.status(400).json({
            code: "MISSING_FIELDS",
            message: "Debe enviar passwordActual y passwordNueva."
        });
    }
    const result = (0, accesoUsuariosService_1.cambiarPassword)(session.usuarioId, passwordActual, passwordNueva);
    if (!result.ok) {
        return res.status(400).json({ code: result.code, message: result.message });
    }
    return res.status(200).json({
        code: "PASSWORD_CHANGED",
        message: "Contraseña actualizada correctamente."
    });
});
