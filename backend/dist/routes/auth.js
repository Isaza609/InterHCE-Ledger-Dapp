"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authRouter = void 0;
const express_1 = require("express");
const autenticacionService_1 = require("../security/autenticacionService");
exports.authRouter = (0, express_1.Router)();
exports.authRouter.post("/login", (req, res) => {
    const identificador = String(req.body?.correo ?? req.body?.usuarioId ?? "").trim();
    const password = String(req.body?.password ?? "").trim();
    if (!identificador || !password) {
        return res.status(400).json({
            code: "MISSING_CREDENTIALS",
            message: "Debe enviar correo o usuarioId, junto con password."
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
        session: result.session
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
