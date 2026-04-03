/**
 * Rutas REST para RF10 – Registro de auditoría para evaluación de desempeño.
 *
 * GET  /audit/metrics          — historial de evaluaciones (solo auditor)
 * GET  /audit/metrics/:id      — detalle de una evaluación
 * POST /audit/run              — lanzar nueva prueba de estrés (solo auditor)
 */

import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validarActorContraUsuarios } from "../access/accesoUsuariosService";
import {
  ejecutarEvaluacion,
  listarMetricas,
  obtenerMetricaPorId
} from "../audit/auditMetricsService";
import {
  iniciarNuevaSesion,
  obtenerSesionActual,
  listarSesiones
} from "../audit/evaluacionSesionService";
import { obtenerActorDesdeRequest } from "../security/autorizacionService";
import type { AuditRunConfig, ModoPrueba } from "../audit/auditMetricModel";

export const auditRouter = Router();

// ─── Guard: solo auditor ──────────────────────────────────────────────────────

function requireAuditor(req: Request, res: Response): boolean {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para acceder a la auditoría de evaluación."
    });
    return false;
  }
  const userCheck = validarActorContraUsuarios(actor);
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

auditRouter.get("/metrics", (req, res) => {
  if (!requireAuditor(req, res)) return;

  try {
    // Filtros opcionales: ?sesionId=<id>  o  ?desde=<ISO>
    const sesionId = typeof req.query.sesionId === "string" ? req.query.sesionId : undefined;
    const desde = typeof req.query.desde === "string" ? req.query.desde : undefined;

    const records = listarMetricas({ sesionId, desde });
    // Resumen sin block_samples para reducir tamaño de respuesta
    const resumen = records.map(({ blockSamples: _bs, rawOutput: _ro, ...r }) => r);
    return res.status(200).json({
      code: "OK",
      message: `${resumen.length} evaluación(es) encontrada(s).`,
      data: resumen
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al listar métricas.";
    return res.status(500).json({ code: "METRICS_LIST_ERROR", message: msg });
  }
});

// ─── GET /audit/metrics/:id ───────────────────────────────────────────────────

auditRouter.get("/metrics/:id", (req, res) => {
  if (!requireAuditor(req, res)) return;

  const { id } = req.params;
  try {
    const record = obtenerMetricaPorId(id);
    if (!record) {
      return res.status(404).json({
        code: "NOT_FOUND",
        message: `No se encontró la evaluación con id '${id}'.`
      });
    }
    return res.status(200).json({ code: "OK", data: record });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener métrica.";
    return res.status(500).json({ code: "METRICS_GET_ERROR", message: msg });
  }
});

// ─── POST /audit/run ─────────────────────────────────────────────────────────

const RunConfigSchema = z.object({
  modo: z.enum(["EOA", "ERC20", "ERC721"]),
  totalTransacciones: z.number().int().min(1).max(10000),
  numSubcuentas: z.number().int().min(1).max(100),
  contractAddress: z.string().optional(),
  batchSize: z.number().int().min(1).max(5000).optional(),
  batchDelayMs: z.number().int().min(0).max(10000).optional(),
  receiptTimeoutMs: z.number().int().min(10000).max(600000).optional()
});

auditRouter.post("/run", async (req, res) => {
  if (!requireAuditor(req, res)) return;

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

  const config: AuditRunConfig = {
    ...parseResult.data,
    modo: parseResult.data.modo as ModoPrueba
  };

  try {
    const { record, fuente, errorPandoras } = await ejecutarEvaluacion(config);
    return res.status(201).json({
      code: "OK",
      message: errorPandoras
        ? `Evaluación completada (fuente: ${fuente}). pandoras-box no pudo ejecutarse, se usó simulación. ID: ${record.id}`
        : `Evaluación completada (fuente: ${fuente}). ID: ${record.id}`,
      fuente,
      advertencia: errorPandoras ?? null,
      data: record
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al ejecutar la prueba de estrés.";
    return res.status(500).json({ code: "RUN_ERROR", message: msg });
  }
});

// ─── POST /audit/session/reset ────────────────────────────────────────────────
// Inicia una nueva sesión de evaluación. Las métricas posteriores se marcan
// con el sesionId devuelto, lo que permite filtrar el historial por sesión.

auditRouter.post("/session/reset", (req, res) => {
  if (!requireAuditor(req, res)) return;

  const actor = obtenerActorDesdeRequest(req);
  const label = typeof req.body?.label === "string" ? req.body.label.trim() : undefined;
  const startBlockRef =
    typeof req.body?.startBlockRef === "number" ? req.body.startBlockRef : undefined;

  try {
    const sesion = iniciarNuevaSesion({
      label,
      startBlockRef,
      iniciadaPor: actor?.usuarioId
    });
    return res.status(201).json({
      code: "OK",
      message: `Nueva sesión de evaluación iniciada. Las métricas registradas a partir de ahora quedarán asociadas al ID '${sesion.id}'.`,
      data: sesion
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al iniciar sesión.";
    return res.status(500).json({ code: "SESSION_ERROR", message: msg });
  }
});

// ─── GET /audit/session/current ───────────────────────────────────────────────

auditRouter.get("/session/current", (req, res) => {
  if (!requireAuditor(req, res)) return;
  try {
    const sesion = obtenerSesionActual();
    if (!sesion) {
      return res.status(200).json({
        code: "NO_SESSION",
        message: "No hay ninguna sesión de evaluación activa. Use POST /audit/session/reset para iniciar una.",
        data: null
      });
    }
    return res.status(200).json({ code: "OK", data: sesion });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al obtener sesión.";
    return res.status(500).json({ code: "SESSION_ERROR", message: msg });
  }
});

// ─── GET /audit/session/list ──────────────────────────────────────────────────

auditRouter.get("/session/list", (req, res) => {
  if (!requireAuditor(req, res)) return;
  try {
    const sesiones = listarSesiones();
    return res.status(200).json({
      code: "OK",
      message: `${sesiones.length} sesión(es) encontrada(s).`,
      data: sesiones
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al listar sesiones.";
    return res.status(500).json({ code: "SESSION_ERROR", message: msg });
  }
});
