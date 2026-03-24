"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluationRouter = void 0;
const express_1 = require("express");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
const prototipoEvaluationService_1 = require("../evaluation/prototipoEvaluationService");
const autorizacionService_1 = require("../security/autorizacionService");
exports.evaluationRouter = (0, express_1.Router)();
exports.evaluationRouter.get("/dashboard", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para consultar el dashboard de evaluación del prototipo."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    if (actor.rol !== "auditor") {
        return res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo el rol auditor puede consultar la evaluación consolidada del Sprint 6."
        });
    }
    try {
        const runs = typeof req.query.runs === "string" ? Number(req.query.runs) : undefined;
        const data = await (0, prototipoEvaluationService_1.generarDashboardEvaluacionPrototipo)({ runs });
        return res.status(200).json({
            code: "OK",
            message: "Dashboard de evaluación del prototipo generado.",
            data
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error interno al generar el dashboard.";
        return res.status(500).json({
            code: "DASHBOARD_ERROR",
            message: msg
        });
    }
});
