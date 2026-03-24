import { Router } from "express";
import { validarActorContraUsuarios } from "../access/accesoUsuariosService";
import { generarDashboardEvaluacionPrototipo } from "../evaluation/prototipoEvaluationService";
import { obtenerActorDesdeRequest } from "../security/autorizacionService";

export const evaluationRouter = Router();

evaluationRouter.get("/dashboard", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para consultar el dashboard de evaluación del prototipo."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
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
    const data = await generarDashboardEvaluacionPrototipo({ runs });
    return res.status(200).json({
      code: "OK",
      message: "Dashboard de evaluación del prototipo generado.",
      data
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error interno al generar el dashboard.";
    return res.status(500).json({
      code: "DASHBOARD_ERROR",
      message: msg
    });
  }
});
