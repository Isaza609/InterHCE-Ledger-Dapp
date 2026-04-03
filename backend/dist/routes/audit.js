"use strict";
/**
 * Rutas REST para RF10 – Registro de auditoría para evaluación de desempeño.
 *
 * GET  /audit/metrics          — historial de evaluaciones (solo auditor)
 * GET  /audit/metrics/:id      — detalle de una evaluación
 * POST /audit/run              — lanzar nueva prueba de estrés (solo auditor)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
const express_1 = require("express");
const zod_1 = require("zod");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
const auditMetricsService_1 = require("../audit/auditMetricsService");
const evaluacionSesionService_1 = require("../audit/evaluacionSesionService");
const autorizacionService_1 = require("../security/autorizacionService");
exports.auditRouter = (0, express_1.Router)();
// ─── Guard: solo auditor ──────────────────────────────────────────────────────
function requireAuditor(req, res) {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para acceder a la auditoría de evaluación."
        });
        return false;
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        res.status(403).json({ code: userCheck.code, message: userCheck.message });
        return false;
    }
    if (actor.rol !== "auditor" && actor.rol !== "super_admin") {
        res.status(403).json({
            code: "FORBIDDEN_ROLE",
            message: "Solo el rol auditor puede acceder al módulo de evaluación de desempeño."
        });
        return false;
    }
    return true;
}
// ─── GET /audit/metrics ───────────────────────────────────────────────────────
exports.auditRouter.get("/metrics", (req, res) => {
    if (!requireAuditor(req, res))
        return;
    try {
        // Filtros opcionales: ?sesionId=<id>  o  ?desde=<ISO>
        const sesionId = typeof req.query.sesionId === "string" ? req.query.sesionId : undefined;
        const desde = typeof req.query.desde === "string" ? req.query.desde : undefined;
        const records = (0, auditMetricsService_1.listarMetricas)({ sesionId, desde });
        // Resumen sin block_samples para reducir tamaño de respuesta
        const resumen = records.map(({ blockSamples: _bs, rawOutput: _ro, ...r }) => r);
        return res.status(200).json({
            code: "OK",
            message: `${resumen.length} evaluación(es) encontrada(s).`,
            data: resumen
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al listar métricas.";
        return res.status(500).json({ code: "METRICS_LIST_ERROR", message: msg });
    }
});
// ─── GET /audit/metrics/:id ───────────────────────────────────────────────────
exports.auditRouter.get("/metrics/:id", (req, res) => {
    if (!requireAuditor(req, res))
        return;
    const { id } = req.params;
    try {
        const record = (0, auditMetricsService_1.obtenerMetricaPorId)(id);
        if (!record) {
            return res.status(404).json({
                code: "NOT_FOUND",
                message: `No se encontró la evaluación con id '${id}'.`
            });
        }
        return res.status(200).json({ code: "OK", data: record });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al obtener métrica.";
        return res.status(500).json({ code: "METRICS_GET_ERROR", message: msg });
    }
});
// ─── POST /audit/run ─────────────────────────────────────────────────────────
const RunConfigSchema = zod_1.z.object({
    modo: zod_1.z.enum(["EOA", "ERC20", "ERC721"]),
    totalTransacciones: zod_1.z.number().int().min(1).max(10000),
    numSubcuentas: zod_1.z.number().int().min(1).max(100),
    contractAddress: zod_1.z.string().optional(),
    batchSize: zod_1.z.number().int().min(1).max(5000).optional(),
    batchDelayMs: zod_1.z.number().int().min(0).max(10000).optional(),
    receiptTimeoutMs: zod_1.z.number().int().min(10000).max(600000).optional()
});
exports.auditRouter.post("/run", async (req, res) => {
    if (!requireAuditor(req, res))
        return;
    const parseResult = RunConfigSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            code: "INVALID_CONFIG",
            message: "Configuración de prueba inválida.",
            details: parseResult.error.issues.map((i) => ({
                field: i.path.join("."),
                issue: i.message
            }))
        });
    }
    const config = {
        ...parseResult.data,
        modo: parseResult.data.modo
    };
    try {
        const { record, fuente, errorPandoras } = await (0, auditMetricsService_1.ejecutarEvaluacion)(config);
        return res.status(201).json({
            code: "OK",
            message: errorPandoras
                ? `Evaluación completada (fuente: ${fuente}). pandoras-box no pudo ejecutarse, se usó simulación. ID: ${record.id}`
                : `Evaluación completada (fuente: ${fuente}). ID: ${record.id}`,
            fuente,
            advertencia: errorPandoras ?? null,
            data: record
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al ejecutar la prueba de estrés.";
        return res.status(500).json({ code: "RUN_ERROR", message: msg });
    }
});
// ─── POST /audit/session/reset ────────────────────────────────────────────────
// Inicia una nueva sesión de evaluación. Las métricas posteriores se marcan
// con el sesionId devuelto, lo que permite filtrar el historial por sesión.
exports.auditRouter.post("/session/reset", (req, res) => {
    if (!requireAuditor(req, res))
        return;
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    const label = typeof req.body?.label === "string" ? req.body.label.trim() : undefined;
    const startBlockRef = typeof req.body?.startBlockRef === "number" ? req.body.startBlockRef : undefined;
    try {
        const sesion = (0, evaluacionSesionService_1.iniciarNuevaSesion)({
            label,
            startBlockRef,
            iniciadaPor: actor?.usuarioId
        });
        return res.status(201).json({
            code: "OK",
            message: `Nueva sesión de evaluación iniciada. Las métricas registradas a partir de ahora quedarán asociadas al ID '${sesion.id}'.`,
            data: sesion
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al iniciar sesión.";
        return res.status(500).json({ code: "SESSION_ERROR", message: msg });
    }
});
// ─── GET /audit/session/current ───────────────────────────────────────────────
exports.auditRouter.get("/session/current", (req, res) => {
    if (!requireAuditor(req, res))
        return;
    try {
        const sesion = (0, evaluacionSesionService_1.obtenerSesionActual)();
        if (!sesion) {
            return res.status(200).json({
                code: "NO_SESSION",
                message: "No hay ninguna sesión de evaluación activa. Use POST /audit/session/reset para iniciar una.",
                data: null
            });
        }
        return res.status(200).json({ code: "OK", data: sesion });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al obtener sesión.";
        return res.status(500).json({ code: "SESSION_ERROR", message: msg });
    }
});
// ─── GET /audit/session/list ──────────────────────────────────────────────────
exports.auditRouter.get("/session/list", (req, res) => {
    if (!requireAuditor(req, res))
        return;
    try {
        const sesiones = (0, evaluacionSesionService_1.listarSesiones)();
        return res.status(200).json({
            code: "OK",
            message: `${sesiones.length} sesión(es) encontrada(s).`,
            data: sesiones
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al listar sesiones.";
        return res.status(500).json({ code: "SESSION_ERROR", message: msg });
    }
});
