import { randomUUID } from "crypto";
import { Router, type Response } from "express";
import {
  almacenarDocumentoClinico,
  buscarEpisodiosPorIdentificadorPaciente,
  generarRegistroOnChainMetadataDesdeDocumento,
  generarDocumentoClinico,
  listarTodosLosEpisodios,
  obtenerRegistroOnChainMetadata,
  recuperarDocumentoClinico
} from "../hce/documentoClinicoService";
import {
  actualizarRegistroLifecycleEpisodio,
  crearRegistroLifecycleEpisodio,
  obtenerEventoUrgenciasEpisodio,
  obtenerRegistroLifecycleEpisodio,
  obtenerVersionesEpisodio,
  prevalidarActualizacionLifecycleEpisodio
} from "../hce/episodioLifecycleService";
import {
  listarEpisodiosAccesiblesPorIps,
  obtenerEstadosPermisosEpisodio,
  listarPermisosEpisodio,
  obtenerPropietarioEpisodio,
  puedeAccederDocumento,
  registrarPropietarioEpisodio,
  otorgarPermisoEpisodio,
  revocarPermisoEpisodio
} from "../hce/permisosEpisodioService";
import {
  listarEventosTrazabilidad,
  obtenerUltimoHashRegistradoOnChain,
  registrarEventoTrazabilidad,
  type TipoEventoTrazabilidad
} from "../hce/trazabilidadService";
import {
  obtenerActorDesdeRequest,
  validarAccesoOperacionClinica
} from "../security/autorizacionService";
import {
  validarActorContraUsuarios,
  buscarUsuarioPorDocumento,
  crearUsuarioIps
} from "../access/accesoUsuariosService";
import { validateEpisodioClinico } from "../hce/validationService";
import {
  BlockchainTraceError,
  obtenerConfiguracionBlockchainReal
} from "../infra/blockchainTraceService";

export const episodesRouter = Router();

function obtenerErrorBlockchainRealtime() {
  const blockchain = obtenerConfiguracionBlockchainReal();
  if (blockchain.enabled) return null;
  return {
    status: 503,
    body: {
      code: "BLOCKCHAIN_REQUIRED",
      message:
        "La operación requiere blockchain real. Configure RPC, firma del backend y dirección del contrato antes de continuar.",
      details: {
        network: blockchain.network,
        chainId: blockchain.chainId,
        contractAddress: blockchain.contractAddress,
        backendRpcConfigured: blockchain.rpcUrlConfigured,
        backendSignerConfigured: blockchain.signerConfigured
      }
    }
  };
}

function responderErrorBlockchain(res: Response, error: unknown): boolean {
  if (!(error instanceof BlockchainTraceError)) return false;
  res.status(503).json({
    code: "BLOCKCHAIN_TRACE_ERROR",
    message: error.message,
    details: error.details
  });
  return true;
}

async function asegurarPropietarioEpisodio(episodeId: string): Promise<string | undefined> {
  const ownerIpsId = obtenerPropietarioEpisodio(episodeId);
  if (ownerIpsId) {
    return ownerIpsId;
  }

  const lifecycle = obtenerRegistroLifecycleEpisodio(episodeId);
  const ownerFromLifecycle = lifecycle?.eventoUrgencias.ipsOrigenId?.trim()
    || lifecycle?.creadoPor.ipsId?.trim();
  if (ownerFromLifecycle) {
    registrarPropietarioEpisodio(episodeId, ownerFromLifecycle);
    return ownerFromLifecycle;
  }

  const almacenado = await recuperarDocumentoClinico(episodeId);
  const ownerFromDocument = almacenado?.document?.prestadorOrigen?.identifier?.[0]?.value?.trim();
  if (ownerFromDocument) {
    registrarPropietarioEpisodio(episodeId, ownerFromDocument);
    return ownerFromDocument;
  }

  return undefined;
}

function actorPuedeConsultarEpisodio(
  episodeId: string,
  rol: string,
  ipsId?: string
): boolean {
  return puedeAccederDocumento(episodeId, ipsId, rol);
}

function actorPuedeConsultarTrazabilidad(
  episodeId: string,
  rol: string,
  ipsId?: string
): boolean {
  if (rol === "auditor") return true;
  const ownerIps = obtenerPropietarioEpisodio(episodeId);
  if (!ownerIps || !ipsId) return false;
  return ownerIps === ipsId || puedeAccederDocumento(episodeId, ipsId, rol);
}

function actorPuedeVerificarIntegridad(
  episodeId: string,
  rol: string,
  ipsId?: string
): boolean {
  if (rol === "auditor") return true;
  return puedeAccederDocumento(episodeId, ipsId, rol);
}

function enriquecerResumenParaActor(
  resumen: Awaited<ReturnType<typeof listarTodosLosEpisodios>>[number],
  rol: string,
  ipsId?: string
) {
  const ownerIpsId = obtenerPropietarioEpisodio(resumen.episodeId);
  const accessScope = rol === "auditor"
    ? "auditoria"
    : ownerIpsId && ipsId === ownerIpsId
      ? "propio"
      : "autorizado";
  return {
    ...resumen,
    ownerIpsId,
    accessScope
  };
}

function filtrarEpisodiosSegunActor(
  episodios: Awaited<ReturnType<typeof listarTodosLosEpisodios>>,
  rol: string,
  ipsId?: string
) {
  return episodios
    .filter((item) => actorPuedeConsultarEpisodio(item.episodeId, rol, ipsId))
    .map((item) => enriquecerResumenParaActor(item, rol, ipsId));
}

/** Lista todos los episodios registrados y autorizados para el actor actual. GET /episodes/list */
episodesRouter.get("/list", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para consultar episodios clínicos."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  try {
    const episodios = await listarTodosLosEpisodios();
    const visibles = filtrarEpisodiosSegunActor(episodios, actor.rol, actor.ipsId);
    return res.status(200).json({
      code: "OK",
      message: visibles.length
        ? `Total autorizado: ${visibles.length} episodio(s).`
        : "No hay episodios autorizados para la sesión actual.",
      episodes: visibles
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al listar";
    return res.status(502).json({
      code: "LIST_ERROR",
      message: "No se pudieron listar los episodios autorizados.",
      details: message
    });
  }
});

/** Busca episodios autorizados por identificador del paciente (ej. cédula). GET /episodes?patientIdentifier=123 */
episodesRouter.get("/", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para consultar episodios clínicos."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  const patientIdentifier = req.query.patientIdentifier;
  if (typeof patientIdentifier !== "string" || !patientIdentifier.trim()) {
    return res.status(400).json({
      code: "MISSING_PARAM",
      message: "Indique el identificador del paciente (cédula/documento) en la query: ?patientIdentifier=valor"
    });
  }
  try {
    const episodios = await buscarEpisodiosPorIdentificadorPaciente(patientIdentifier.trim());
    const visibles = filtrarEpisodiosSegunActor(episodios, actor.rol, actor.ipsId);
    return res.status(200).json({
      code: "OK",
      message: visibles.length
        ? `Se encontraron ${visibles.length} episodio(s) autorizados.`
        : "No se encontraron episodios autorizados para este paciente.",
      episodes: visibles
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al buscar";
    return res.status(502).json({
      code: "SEARCH_ERROR",
      message: "No se pudo buscar por identificador del paciente.",
      details: message
    });
  }
});

episodesRouter.post("/validate", (req, res) => {
  const validation = validateEpisodioClinico(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "El episodio clínico no cumple el modelo de HCE.",
      details: validation.issues ?? []
    });
  }

  return res.status(200).json({
    code: "OK",
    message: "Episodio clínico válido estructuralmente.",
    data: validation.data
  });
});


episodesRouter.get("/traceability/search", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para consultar trazabilidad."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (!["auditor", "admin_ips", "profesional_salud"].includes(actor.rol)) {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "El rol actual no está autorizado para consultar trazabilidad."
    });
  }

  const episodeId = typeof req.query.episodeId === "string" ? req.query.episodeId.trim() : undefined;
  const eventType = typeof req.query.eventType === "string"
    ? req.query.eventType.trim() as TipoEventoTrazabilidad
    : undefined;
  const ipsId = typeof req.query.ipsId === "string" ? req.query.ipsId.trim() : undefined;

  if (actor.rol !== "auditor" && ipsId && ipsId !== actor.ipsId) {
    return res.status(403).json({
      code: "TRACEABILITY_SCOPE_FORBIDDEN",
      message: "Solo puede consultar trazabilidad dentro del alcance de su IPS."
    });
  }

  if (episodeId) {
    if (!actorPuedeConsultarTrazabilidad(episodeId, actor.rol, actor.ipsId)) {
      return res.status(403).json({
        code: "TRACEABILITY_ACCESS_FORBIDDEN",
        message: "El actor actual no está autorizado para consultar esta trazabilidad."
      });
    }

    const events = listarEventosTrazabilidad({ episodeId, ...(eventType ? { eventType } : {}) });
    return res.status(200).json({
      code: "OK",
      message: events.length
        ? `Se encontraron ${events.length} evento(s) para el episodio.`
        : "No hay eventos de trazabilidad para el filtro indicado.",
      data: {
        total: events.length,
        events,
        filters: {
          episodeId,
          eventType,
          ipsId: actor.rol === "auditor" ? ipsId : actor.ipsId
        }
      }
    });
  }

  let events = listarEventosTrazabilidad({
    ...(eventType ? { eventType } : {}),
    ...(actor.rol === "auditor" && ipsId ? { ipsId } : {})
  });

  if (actor.rol !== "auditor") {
    const accesibles = new Set(listarEpisodiosAccesiblesPorIps(actor.ipsId, actor.rol));
    events = events.filter((item) => accesibles.has(item.episodeId));
  }

  return res.status(200).json({
    code: "OK",
    message: events.length
      ? `Se encontraron ${events.length} evento(s) de trazabilidad.`
      : "No hay eventos de trazabilidad para el alcance actual.",
    data: {
      total: events.length,
      events,
      filters: {
        episodeId,
        eventType,
        ipsId: actor.rol === "auditor" ? ipsId : actor.ipsId
      }
    }
  });
});

episodesRouter.post("/", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  const acceso = validarAccesoOperacionClinica(actor);
  if (!acceso.ok) {
    return res.status(403).json({
      code: acceso.code,
      message: acceso.message
    });
  }
  const actorSeguro = actor!;
  const userCheck = validarActorContraUsuarios(actorSeguro);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }

  const validation = validateEpisodioClinico(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message:
        "El episodio clínico no cumple el modelo de HCE y no puede registrarse.",
      details: validation.issues ?? []
    });
  }

  const episodeId = randomUUID();
  const documento = generarDocumentoClinico(validation.data!);
  const blockchainError = obtenerErrorBlockchainRealtime();
  if (blockchainError) {
    return res.status(blockchainError.status).json(blockchainError.body);
  }
  const ipsPayload = validation.data?.prestadorOrigen?.identifier?.[0]?.value?.trim();
  if (!ipsPayload || actorSeguro.ipsId !== ipsPayload) {
    return res.status(403).json({
      code: "IPS_MISMATCH",
      message:
        "La IPS del actor (x-ips-id) debe coincidir con la IPS origen del episodio."
    });
  }
  try {
    await almacenarDocumentoClinico(episodeId, documento);
    const onChain = generarRegistroOnChainMetadataDesdeDocumento(episodeId, documento);
    const lifecycle = crearRegistroLifecycleEpisodio(
      episodeId,
      documento,
      actorSeguro,
      onChain
    );
    registrarPropietarioEpisodio(episodeId, actorSeguro.ipsId ?? "");
    const traceEvent = await registrarEventoTrazabilidad({
      episodeId,
      eventType: "EPISODE_CREATED",
      actor: actorSeguro,
      metadata: {
        version: lifecycle.versionActual,
        documentHash: onChain.documentHash,
        eventId: lifecycle.eventoUrgencias.eventoUrgenciasId,
        sourceIpsId: lifecycle.eventoUrgencias.ipsOrigenId
      }
    });
    const patientId = validation.data?.patient?.identifier?.[0]?.value?.trim();
    let pacienteAutoCreado = false;
    if (patientId && !buscarUsuarioPorDocumento(patientId)) {
      const nombre = [
        validation.data?.patient?.name?.[0]?.given?.join(" "),
        validation.data?.patient?.name?.[0]?.family
      ].filter(Boolean).join(" ") || `Paciente ${patientId}`;
      const createResult = crearUsuarioIps({
        usuarioId: `paciente-${patientId}`,
        nombre,
        password: `Paciente-${patientId}!`,
        rol: "paciente",
        ipsId: actorSeguro.ipsId ?? "",
        documentoIdentidad: patientId
      });
      pacienteAutoCreado = createResult.ok;
    }

    return res.status(201).json({
      code: "EPISODE_REGISTERED",
      message:
        "Episodio clínico registrado. Documento almacenado off-chain; hash disponible para registro on-chain.",
      episodeId,
      documentHash: onChain.documentHash,
      event: lifecycle.eventoUrgencias,
      version: lifecycle.versionActual,
      onChainMetadata: onChain,
      traceEvent,
      data: validation.data,
      pacienteAutoCreado
    });
  } catch (err) {
    if (responderErrorBlockchain(res, err)) {
      return;
    }
    const message = err instanceof Error ? err.message : "Error al persistir en HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo almacenar el documento en el servidor FHIR.",
      details: message
    });
  }
});

episodesRouter.put("/:id", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  const acceso = validarAccesoOperacionClinica(actor);
  if (!acceso.ok) {
    return res.status(403).json({
      code: acceso.code,
      message: acceso.message
    });
  }
  const actorSeguro = actor!;
  const userCheck = validarActorContraUsuarios(actorSeguro);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }

  const validation = validateEpisodioClinico(req.body);

  if (!validation.valid) {
    return res.status(400).json({
      code: "VALIDATION_ERROR",
      message:
        "El episodio clínico no cumple el modelo de HCE y no puede actualizarse.",
      details: validation.issues ?? []
    });
  }

  const episodeId = req.params.id;
  const documento = generarDocumentoClinico(validation.data!);
  const blockchainError = obtenerErrorBlockchainRealtime();
  if (blockchainError) {
    return res.status(blockchainError.status).json(blockchainError.body);
  }
  const precheck = prevalidarActualizacionLifecycleEpisodio(
    episodeId,
    documento,
    actorSeguro
  );
  if (!precheck.ok) {
    const status = precheck.errorCode === "EPISODE_NOT_FOUND"
      ? 404
      : precheck.errorCode === "FORBIDDEN_IPS_UPDATE"
        ? 403
        : 409;
    return res.status(status).json({
      code: precheck.errorCode,
      message: precheck.error
    });
  }

  const previewOnChain = generarRegistroOnChainMetadataDesdeDocumento(episodeId, documento);
  try {
    await almacenarDocumentoClinico(episodeId, documento);
    const lifecycleUpdated = actualizarRegistroLifecycleEpisodio(
      episodeId,
      documento,
      actorSeguro,
      previewOnChain
    );
    if (lifecycleUpdated.error) {
      const status = lifecycleUpdated.errorCode === "EPISODE_NOT_FOUND"
        ? 404
        : lifecycleUpdated.errorCode === "FORBIDDEN_IPS_UPDATE"
          ? 403
          : 409;
      return res.status(status).json({
        code: lifecycleUpdated.errorCode ?? "UPDATE_ERROR",
        message: lifecycleUpdated.error
      });
    }
    const lifecycle = lifecycleUpdated.record!;
    const traceEvent = await registrarEventoTrazabilidad({
      episodeId,
      eventType: "EPISODE_UPDATED",
      actor: actorSeguro,
      metadata: {
        version: lifecycle.versionActual,
        documentHash: previewOnChain.documentHash,
        eventId: lifecycle.eventoUrgencias.eventoUrgenciasId,
        sourceIpsId: lifecycle.eventoUrgencias.ipsOrigenId
      }
    });
    return res.status(200).json({
      code: "EPISODE_UPDATED",
      message:
        "Episodio clínico actualizado. Documento off-chain y hash recalculados.",
      episodeId,
      documentHash: previewOnChain.documentHash,
      version: lifecycle.versionActual,
      event: lifecycle.eventoUrgencias,
      onChainMetadata: previewOnChain,
      traceEvent,
      data: validation.data
    });
  } catch (err) {
    if (responderErrorBlockchain(res, err)) {
      return;
    }
    const message = err instanceof Error ? err.message : "Error al actualizar en HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo actualizar el documento en el servidor FHIR.",
      details: message
    });
  }
});

/** Recupera el documento clínico off-chain asociado al episodio (HU3-E0). Respetará permisos cuando exista control de acceso. */
episodesRouter.get("/:id/document", async (req, res) => {
  try {
    const actor = obtenerActorDesdeRequest(req);
    if (!actor) {
      return res.status(403).json({
        code: "MISSING_OR_INVALID_ROLE",
        message: "Debe enviar contexto de actor para acceder a documentos clínicos."
      });
    }
    const userCheck = validarActorContraUsuarios(actor);
    if (!userCheck.ok) {
      return res.status(403).json({
        code: userCheck.code,
        message: userCheck.message
      });
    }
    if (!puedeAccederDocumento(req.params.id, actor.ipsId, actor.rol)) {
      return res.status(403).json({
        code: "DOCUMENT_ACCESS_FORBIDDEN",
        message: "No existen permisos válidos para acceder a este documento clínico."
      });
    }
    const blockchainError = obtenerErrorBlockchainRealtime();
    if (blockchainError) {
      return res.status(blockchainError.status).json(blockchainError.body);
    }
    const almacenado = await recuperarDocumentoClinico(req.params.id);
    if (!almacenado) {
      return res.status(404).json({
        code: "DOCUMENT_NOT_FOUND",
        message: "No existe documento clínico asociado a este episodio."
      });
    }
    const auditTrace = await registrarEventoTrazabilidad({
      episodeId: req.params.id,
      eventType: "AUDITABLE_ACCESS",
      actor,
      metadata: {
        sourceIpsId: obtenerPropietarioEpisodio(req.params.id),
        targetIpsId: actor.ipsId,
        accessType: "DOCUMENT_READ"
      }
    });
    return res.status(200).json({
      episodeId: almacenado.episodeId,
      hash: almacenado.hash,
      createdAt: almacenado.createdAt,
      document: almacenado.document,
      auditTrace
    });
  } catch (err) {
    if (responderErrorBlockchain(res, err)) {
      return;
    }
    const message = err instanceof Error ? err.message : "Error al recuperar desde HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo recuperar el documento desde el servidor FHIR.",
      details: message
    });
  }
});

episodesRouter.get("/:id/permissions", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar contexto de actor para consultar permisos."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  await asegurarPropietarioEpisodio(req.params.id);
  return res.status(200).json({
    code: "OK",
    permissions: listarPermisosEpisodio(req.params.id)
  });
});

episodesRouter.post("/:id/permissions/grant", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar contexto de actor para gestionar permisos."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (actor.rol !== "admin_ips" && actor.rol !== "super_admin") {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message:
        "Solo el administrador IPS de la institución propietaria o el super administrador pueden otorgar permisos."
    });
  }
  const targetIps = String(req.body?.targetIpsId ?? "").trim();
  if (!targetIps) {
    return res.status(400).json({
      code: "MISSING_TARGET_IPS",
      message: "Debe enviar targetIpsId."
    });
  }
  const blockchainError = obtenerErrorBlockchainRealtime();
  if (blockchainError) {
    return res.status(blockchainError.status).json(blockchainError.body);
  }
  await asegurarPropietarioEpisodio(req.params.id);
  const ownerIps = obtenerPropietarioEpisodio(req.params.id);
  if (!ownerIps) {
    return res.status(404).json({
      code: "EPISODE_OWNER_NOT_FOUND",
      message:
        "No hay propietario IPS registrado para este episodio. Verifique el ID o consulte el episodio primero."
    });
  }
  const ipsActorParaPermiso =
    actor.rol === "super_admin" ? ownerIps : (actor.ipsId ?? "");
  if (actor.rol === "admin_ips" && actor.ipsId !== ownerIps) {
    return res.status(403).json({
      code: "FORBIDDEN_IPS",
      message:
        "Solo el administrador de la IPS propietaria del episodio puede otorgar permisos a otras IPS."
    });
  }
  const result = otorgarPermisoEpisodio(req.params.id, ipsActorParaPermiso, targetIps);
  if (!result.ok) {
    const status = result.code === "PERMISSION_ALREADY_ACTIVE"
      ? 409
      : result.code === "EPISODE_OWNER_NOT_FOUND"
        ? 404
        : 403;
    return res.status(status).json({
      code: result.code,
      message: result.message
    });
  }
  try {
    const traceEvent = await registrarEventoTrazabilidad({
      episodeId: req.params.id,
      eventType: "PERMISSION_GRANTED",
      actor,
      metadata: {
        sourceIpsId: result.permission.sourceIpsId,
        targetIpsId: result.permission.targetIpsId,
        granted: true
      }
    });
    return res.status(200).json({
      code: "PERMISSION_GRANTED",
      permissions: listarPermisosEpisodio(req.params.id),
      traceEvent
    });
  } catch (err) {
    if (responderErrorBlockchain(res, err)) {
      return;
    }
    const message = err instanceof Error ? err.message : "No fue posible registrar el permiso.";
    return res.status(500).json({
      code: "PERMISSION_TRACE_ERROR",
      message
    });
  }
});

episodesRouter.post("/:id/permissions/revoke", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe enviar contexto de actor para gestionar permisos."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (actor.rol !== "admin_ips" && actor.rol !== "super_admin") {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message:
        "Solo el administrador IPS de la institución propietaria o el super administrador pueden revocar permisos."
    });
  }
  const targetIps = String(req.body?.targetIpsId ?? "").trim();
  if (!targetIps) {
    return res.status(400).json({
      code: "MISSING_TARGET_IPS",
      message: "Debe enviar targetIpsId."
    });
  }
  const blockchainError = obtenerErrorBlockchainRealtime();
  if (blockchainError) {
    return res.status(blockchainError.status).json(blockchainError.body);
  }
  await asegurarPropietarioEpisodio(req.params.id);
  const ownerIpsRev = obtenerPropietarioEpisodio(req.params.id);
  if (!ownerIpsRev) {
    return res.status(404).json({
      code: "EPISODE_OWNER_NOT_FOUND",
      message:
        "No hay propietario IPS registrado para este episodio. Verifique el ID o consulte el episodio primero."
    });
  }
  const ipsActorParaRevoke =
    actor.rol === "super_admin" ? ownerIpsRev : (actor.ipsId ?? "");
  if (actor.rol === "admin_ips" && actor.ipsId !== ownerIpsRev) {
    return res.status(403).json({
      code: "FORBIDDEN_IPS",
      message:
        "Solo el administrador de la IPS propietaria del episodio puede revocar permisos."
    });
  }
  const result = revocarPermisoEpisodio(req.params.id, ipsActorParaRevoke, targetIps);
  if (!result.ok) {
    const status = result.code === "PERMISSION_NOT_ACTIVE"
      ? 409
      : result.code === "EPISODE_OWNER_NOT_FOUND"
        ? 404
        : 403;
    return res.status(status).json({
      code: result.code,
      message: result.message
    });
  }
  try {
    const traceEvent = await registrarEventoTrazabilidad({
      episodeId: req.params.id,
      eventType: "PERMISSION_REVOKED",
      actor,
      metadata: {
        sourceIpsId: result.permission.sourceIpsId,
        targetIpsId: result.permission.targetIpsId,
        granted: false
      }
    });
    return res.status(200).json({
      code: "PERMISSION_REVOKED",
      permissions: listarPermisosEpisodio(req.params.id),
      traceEvent
    });
  } catch (err) {
    if (responderErrorBlockchain(res, err)) {
      return;
    }
    const message = err instanceof Error ? err.message : "No fue posible revocar el permiso.";
    return res.status(500).json({
      code: "PERMISSION_TRACE_ERROR",
      message
    });
  }
});

/**
 * Obtiene metadatos aptos para registro on-chain sin exponer estructura clínica (HU4-E0).
 */
episodesRouter.get("/:id/onchain-metadata", async (req, res) => {
  try {
    const metadata = await obtenerRegistroOnChainMetadata(req.params.id);
    if (!metadata) {
      return res.status(404).json({
        code: "ONCHAIN_METADATA_NOT_FOUND",
        message: "No existe episodio/documento para generar metadatos on-chain."
      });
    }
    return res.status(200).json({
      code: "OK",
      message: "Metadatos on-chain generados (sin datos clínicos).",
      data: metadata
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al construir metadatos on-chain";
    return res.status(502).json({
      code: "ONCHAIN_METADATA_ERROR",
      message: "No se pudieron generar metadatos para registro on-chain.",
      details: message
    });
  }
});

episodesRouter.get("/:id/integrity", async (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para verificar integridad."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (!actorPuedeVerificarIntegridad(req.params.id, actor.rol, actor.ipsId)) {
    return res.status(403).json({
      code: "DOCUMENT_ACCESS_FORBIDDEN",
      message: "No existen permisos válidos para verificar integridad sobre este episodio."
    });
  }
  const blockchainError = obtenerErrorBlockchainRealtime();
  if (blockchainError) {
    return res.status(blockchainError.status).json(blockchainError.body);
  }

  try {
    const almacenado = await recuperarDocumentoClinico(req.params.id);
    if (!almacenado) {
      return res.status(404).json({
        code: "DOCUMENT_NOT_FOUND",
        message: "No existe documento clínico asociado a este episodio."
      });
    }

    const onChain = obtenerUltimoHashRegistradoOnChain(req.params.id);
    if (!onChain.documentHash || !onChain.traceEvent) {
      return res.status(404).json({
        code: "ONCHAIN_HASH_NOT_FOUND",
        message: "No existe hash registrado en trazabilidad para este episodio."
      });
    }

    const isValid = onChain.documentHash === almacenado.hash;
    const auditTrace = await registrarEventoTrazabilidad({
      episodeId: req.params.id,
      eventType: "INTEGRITY_CHECK",
      actor,
      metadata: {
        integrityMatch: isValid,
        sourceIpsId: obtenerPropietarioEpisodio(req.params.id),
        targetIpsId: actor.ipsId
      }
    });

    return res.status(200).json({
      code: "OK",
      data: {
        episodeId: req.params.id,
        onChainHash: onChain.documentHash,
        offChainHash: almacenado.hash,
        isIntegrityValid: isValid,
        checkedAt: new Date().toISOString(),
        evidence: {
          sourceTraceId: onChain.traceEvent.traceId,
          sourceTransactionHash: onChain.traceEvent.evidence.transactionHash,
          contractAddress: onChain.traceEvent.evidence.contractAddress,
          network: onChain.traceEvent.evidence.network,
          auditTrace
        }
      }
    });
  } catch (err) {
    if (responderErrorBlockchain(res, err)) {
      return;
    }
    const message = err instanceof Error ? err.message : "Error al verificar integridad";
    return res.status(502).json({
      code: "INTEGRITY_CHECK_ERROR",
      message: "No se pudo verificar la integridad del episodio.",
      details: message
    });
  }
});

episodesRouter.get("/:id/event", (req, res) => {
  const event = obtenerEventoUrgenciasEpisodio(req.params.id);
  if (!event) {
    return res.status(404).json({
      code: "EVENT_NOT_FOUND",
      message: "No existe evento de urgencias asociado a este episodio."
    });
  }
  return res.status(200).json({
    code: "OK",
    data: event
  });
});

episodesRouter.get("/:id/versions", (req, res) => {
  const versions = obtenerVersionesEpisodio(req.params.id);
  if (!versions.length) {
    return res.status(404).json({
      code: "VERSIONS_NOT_FOUND",
      message: "No existe historial de versiones para este episodio."
    });
  }
  return res.status(200).json({
    code: "OK",
    total: versions.length,
    versions
  });
});

episodesRouter.get("/:id/traceability", (req, res) => {
  const actor = obtenerActorDesdeRequest(req);
  if (!actor) {
    return res.status(403).json({
      code: "MISSING_OR_INVALID_ROLE",
      message: "Debe autenticarse para consultar la trazabilidad."
    });
  }
  const userCheck = validarActorContraUsuarios(actor);
  if (!userCheck.ok) {
    return res.status(403).json({
      code: userCheck.code,
      message: userCheck.message
    });
  }
  if (!actorPuedeConsultarTrazabilidad(req.params.id, actor.rol, actor.ipsId)) {
    return res.status(403).json({
      code: "TRACEABILITY_ACCESS_FORBIDDEN",
      message: "El actor actual no está autorizado para consultar esta trazabilidad."
    });
  }
  const lifecycle = obtenerRegistroLifecycleEpisodio(req.params.id);
  if (!lifecycle) {
    return res.status(404).json({
      code: "TRACEABILITY_NOT_FOUND",
      message: "No existe trazabilidad para este episodio."
    });
  }
  const estadosPermisos = obtenerEstadosPermisosEpisodio(req.params.id);
  const traceEvents = listarEventosTrazabilidad({ episodeId: req.params.id });
  const ipsInvolucradas = [...new Set([
    lifecycle.eventoUrgencias.ipsOrigenId,
    ...lifecycle.versiones.map((item) => item.actor.ipsId),
    ...estadosPermisos.map((item) => item.sourceIpsId),
    ...estadosPermisos.map((item) => item.targetIpsId)
  ].filter((item): item is string => Boolean(item?.trim())))].sort((a, b) => a.localeCompare(b));

  return res.status(200).json({
    code: "OK",
    data: {
      ...lifecycle,
      permisosActivos: listarPermisosEpisodio(req.params.id),
      estadosPermisos,
      traceEvents,
      continuidad: {
        ownerIpsId: obtenerPropietarioEpisodio(req.params.id),
        ipsInvolucradas
      }
    }
  });
});
