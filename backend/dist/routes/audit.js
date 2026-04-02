"use strict";
/**
 * Rutas REST para RF10 – Registro de auditoría para evaluación de desempeño.
 *
 * GET  /audit/metrics          — historial de evaluaciones (solo auditor)
 * GET  /audit/metrics-comparative — historial resumido de corridas batch comparativas
 * GET  /audit/metrics/:id      — detalle de una evaluación
 * POST /audit/run              — lanzar nueva prueba de estrés (solo auditor)
 * POST /audit/run-batch        — lanzar prueba comparativa EOA/ERC20/ERC721
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditRouter = void 0;
const crypto_1 = require("crypto");
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
// ─── GET /audit/metrics-comparative ──────────────────────────────────────────
exports.auditRouter.get("/metrics-comparative", (req, res) => {
    if (!requireAuditor(req, res))
        return;
    try {
        // Se filtra por batchId + totalTransacciones para no mezclar corridas
        // individuales históricas, ya que el modelo actual ya persiste totalTransacciones.
        const records = (0, auditMetricsService_1.listarMetricasComparativas)();
        const resumen = records.map(({ blockSamples: _bs, rawOutput: _ro, ...r }) => r);
        return res.status(200).json({
            code: "OK",
            message: `${resumen.length} corrida(s) comparativa(s) encontrada(s).`,
            data: resumen
        });
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : "Error al listar métricas comparativas.";
        return res.status(500).json({ code: "METRICS_COMPARATIVE_ERROR", message: msg });
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
    rpcUrl: zod_1.z.string().url("rpcUrl debe ser una URL válida."),
    modo: zod_1.z.enum(["EOA", "ERC20", "ERC721"]),
    totalTransacciones: zod_1.z.number().int().min(1).max(10000),
    numSubcuentas: zod_1.z.number().int().min(1).max(100),
    contractAddress: zod_1.z.string().optional(),
    mnemonic: zod_1.z.string().min(10).optional(),
    batchSize: zod_1.z.number().int().min(1).max(5000).optional(),
    umbralTpsVerde: zod_1.z.number().positive().optional(),
    umbralTpsAmarillo: zod_1.z.number().positive().optional(),
    umbralLatenciaVerdeMs: zod_1.z.number().positive().optional(),
    umbralLatenciaAmarilloMs: zod_1.z.number().positive().optional(),
    umbralTasaExitoVerde: zod_1.z.number().min(0).max(100).optional()
});
const RunBatchSchema = zod_1.z.object({
    rpcUrl: zod_1.z.string().url("rpcUrl debe ser una URL válida."),
    totalTransacciones: zod_1.z.number().int().min(1).max(10000),
    mnemonic: zod_1.z.string().min(10).optional()
});
const MODOS_BATCH = ["EOA", "ERC20", "ERC721"];
const BATCH_DEFAULT_NUM_SUBCUENTAS = 5;
const BATCH_DEFAULT_BATCH_SIZE = 10;
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
                ? `Evaluación completada · Simulación con datos del nodo RPC (pandoras-box no pudo ejecutarse). ID: ${record.id}`
                : fuente === "pandoras-box"
                    ? `Evaluación completada · Ejecución directa con pandoras-box en Sepolia. ID: ${record.id}`
                    : fuente === "pandoras-box-recovery"
                        ? `Evaluación completada · Ejecución directa con pandoras-box (recibos recolectados por backend). ID: ${record.id}`
                        : `Evaluación completada · Simulación con datos del nodo RPC (sin mnemonic configurado). ID: ${record.id}`,
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
// ─── POST /audit/run-batch ───────────────────────────────────────────────────
exports.auditRouter.post("/run-batch", async (req, res) => {
    if (!requireAuditor(req, res))
        return;
    const parseResult = RunBatchSchema.safeParse(req.body);
    if (!parseResult.success) {
        return res.status(400).json({
            code: "INVALID_BATCH_CONFIG",
            message: "Configuración batch inválida.",
            details: parseResult.error.issues.map((i) => ({
                field: i.path.join("."),
                issue: i.message
            }))
        });
    }
    const batchId = (0, crypto_1.randomUUID)();
    const resultados = [];
    const advertencias = [];
    for (const modo of MODOS_BATCH) {
        const config = {
            rpcUrl: parseResult.data.rpcUrl,
            modo,
            totalTransacciones: parseResult.data.totalTransacciones,
            numSubcuentas: BATCH_DEFAULT_NUM_SUBCUENTAS,
            batchSize: BATCH_DEFAULT_BATCH_SIZE,
            mnemonic: parseResult.data.mnemonic
        };
        try {
            console.log("BATCH: iniciando modo", modo);
            const { record, fuente, errorPandoras } = await (0, auditMetricsService_1.ejecutarEvaluacion)(config, {
                batchId,
                totalTransacciones: parseResult.data.totalTransacciones
            });
            console.log("BATCH: completado modo", modo, "TPS:", record.tpsPromedio);
            resultados.push({
                modo,
                record,
                fuente,
                advertencia: errorPandoras
            });
            if (errorPandoras) {
                advertencias.push({
                    modo,
                    detalle: errorPandoras,
                    fuente
                });
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Error desconocido al ejecutar el modo.";
            console.error("BATCH: error en", modo, err);
            resultados.push({ modo, error: message });
        }
    }
    const records = resultados.flatMap((item) => item.record ? [item.record] : []);
    const errores = resultados
        .filter((item) => item.error)
        .map((item) => ({ modo: item.modo, error: item.error }));
    return res.status(201).json({
        code: errores.length > 0 ? "PARTIAL_OK" : "OK",
        message: errores.length > 0
            ? `Prueba comparativa finalizada con ${records.length} éxito(s) y ${errores.length} error(es). Batch ID: ${batchId}`
            : `Prueba comparativa completada para ${MODOS_BATCH.join(", ")}. Batch ID: ${batchId}`,
        batchId,
        results: resultados,
        data: records,
        advertencias,
        errores
    });
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
