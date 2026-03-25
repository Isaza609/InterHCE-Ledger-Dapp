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
    const records = listarMetricas();
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
  rpcUrl: z.string().url("rpcUrl debe ser una URL válida."),
  modo: z.enum(["EOA", "ERC20", "ERC721"]),
  totalTransacciones: z.number().int().min(1).max(10000),
  numSubcuentas: z.number().int().min(1).max(100),
  contractAddress: z.string().optional(),
  mnemonic: z.string().min(10).optional(),
  batchSize: z.number().int().min(1).max(5000).optional(),
  umbralTpsVerde: z.number().positive().optional(),
  umbralTpsAmarillo: z.number().positive().optional(),
  umbralLatenciaVerdeMs: z.number().positive().optional(),
  umbralLatenciaAmarilloMs: z.number().positive().optional(),
  umbralTasaExitoVerde: z.number().min(0).max(100).optional()
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
