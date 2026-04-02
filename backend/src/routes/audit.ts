/**
 * Rutas REST para RF10 – Registro de auditoría para evaluación de desempeño.
 *
 * GET  /audit/metrics          — historial de evaluaciones (solo auditor)
 * GET  /audit/metrics-comparative — historial resumido de corridas batch comparativas
 * GET  /audit/metrics/:id      — detalle de una evaluación
 * POST /audit/run              — lanzar nueva prueba de estrés (solo auditor)
 * POST /audit/run-batch        — lanzar prueba comparativa EOA/ERC20/ERC721
 */

import { randomUUID } from "crypto";
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { validarActorContraUsuarios } from "../access/accesoUsuariosService";
import {
  ejecutarEvaluacion,
  listarMetricas,
  listarMetricasComparativas,
  obtenerMetricaPorId
} from "../audit/auditMetricsService";
import {
  iniciarNuevaSesion,
  obtenerSesionActual,
  listarSesiones
} from "../audit/evaluacionSesionService";
import { obtenerActorDesdeRequest } from "../security/autorizacionService";
import type { AuditMetricRecord, AuditRunConfig, ModoPrueba } from "../audit/auditMetricModel";

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

// ─── GET /audit/metrics-comparative ──────────────────────────────────────────

auditRouter.get("/metrics-comparative", (req, res) => {
  if (!requireAuditor(req, res)) return;

  try {
    // Se filtra por batchId + totalTransacciones para no mezclar corridas
    // individuales históricas, ya que el modelo actual ya persiste totalTransacciones.
    const records = listarMetricasComparativas();
    const resumen = records.map(({ blockSamples: _bs, rawOutput: _ro, ...r }) => r);
    return res.status(200).json({
      code: "OK",
      message: `${resumen.length} corrida(s) comparativa(s) encontrada(s).`,
      data: resumen
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al listar métricas comparativas.";
    return res.status(500).json({ code: "METRICS_COMPARATIVE_ERROR", message: msg });
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

const RunBatchSchema = z.object({
  rpcUrl: z.string().url("rpcUrl debe ser una URL válida."),
  totalTransacciones: z.number().int().min(1).max(10000),
  mnemonic: z.string().min(10).optional()
});

const MODOS_BATCH: ModoPrueba[] = ["EOA", "ERC20", "ERC721"];
const BATCH_DEFAULT_NUM_SUBCUENTAS = 5;
const BATCH_DEFAULT_BATCH_SIZE = 10;

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
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al ejecutar la prueba de estrés.";
    return res.status(500).json({ code: "RUN_ERROR", message: msg });
  }
});

// ─── POST /audit/run-batch ───────────────────────────────────────────────────

auditRouter.post("/run-batch", async (req, res) => {
  if (!requireAuditor(req, res)) return;

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

  const batchId = randomUUID();
  const resultados: Array<{
    modo: ModoPrueba;
    record?: AuditMetricRecord;
    fuente?: string;
    advertencia?: string;
    error?: string;
  }> = [];
  const advertencias: Array<{ modo: ModoPrueba; detalle: string; fuente: string }> = [];

  for (const modo of MODOS_BATCH) {
    const config: AuditRunConfig = {
      rpcUrl: parseResult.data.rpcUrl,
      modo,
      totalTransacciones: parseResult.data.totalTransacciones,
      numSubcuentas: BATCH_DEFAULT_NUM_SUBCUENTAS,
      batchSize: BATCH_DEFAULT_BATCH_SIZE,
      mnemonic: parseResult.data.mnemonic
    };

    try {
      console.log("BATCH: iniciando modo", modo);
      const { record, fuente, errorPandoras } = await ejecutarEvaluacion(config, {
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido al ejecutar el modo.";
      console.error("BATCH: error en", modo, err);
      resultados.push({ modo, error: message });
    }
  }

  const records = resultados.flatMap((item) => item.record ? [item.record] : []);
  const errores = resultados
    .filter((item) => item.error)
    .map((item) => ({ modo: item.modo, error: item.error as string }));

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
