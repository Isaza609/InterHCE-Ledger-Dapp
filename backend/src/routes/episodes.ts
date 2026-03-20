import { randomUUID } from "crypto";
import { Router } from "express";
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
  registrarEventoTrazabilidad
} from "../hce/trazabilidadService";
import {
  obtenerActorDesdeRequest,
  validarAccesoOperacionClinica
} from "../security/autorizacionService";
import { validarActorContraUsuarios } from "../access/accesoUsuariosService";
import { validateEpisodioClinico } from "../hce/validationService";

export const episodesRouter = Router();

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

/** Lista todos los episodios registrados. GET /episodes/list */
episodesRouter.get("/list", async (_req, res) => {
  try {
    const episodios = await listarTodosLosEpisodios();
    return res.status(200).json({
      code: "OK",
      message: `Total: ${episodios.length} episodio(s).`,
      episodes: episodios
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al listar";
    return res.status(502).json({
      code: "LIST_ERROR",
      message: "No se pudieron listar los episodios.",
      details: message
    });
  }
});

/** Busca episodios por identificador del paciente (ej. cédula). GET /episodes?patientIdentifier=123 */
episodesRouter.get("/", async (req, res) => {
  const patientIdentifier = req.query.patientIdentifier;
  if (typeof patientIdentifier !== "string" || !patientIdentifier.trim()) {
    return res.status(400).json({
      code: "MISSING_PARAM",
      message: "Indique el identificador del paciente (cédula/documento) en la query: ?patientIdentifier=valor"
    });
  }
  try {
    const episodios = await buscarEpisodiosPorIdentificadorPaciente(patientIdentifier.trim());
    return res.status(200).json({
      code: "OK",
      message: episodios.length
        ? `Se encontraron ${episodios.length} episodio(s).`
        : "No se encontraron episodios para este paciente.",
      episodes: episodios
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
      data: validation.data
    });
  } catch (err) {
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
    const message = err instanceof Error ? err.message : "Error al recuperar desde HAPI FHIR";
    return res.status(502).json({
      code: "FHIR_STORAGE_ERROR",
      message: "No se pudo recuperar el documento desde el servidor FHIR.",
      details: message
    });
  }
});

episodesRouter.get("/:id/permissions", (req, res) => {
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
  if (actor.rol !== "admin_ips") {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips puede otorgar permisos sobre documentos."
    });
  }
  const targetIps = String(req.body?.targetIpsId ?? "").trim();
  if (!targetIps) {
    return res.status(400).json({
      code: "MISSING_TARGET_IPS",
      message: "Debe enviar targetIpsId."
    });
  }
  const result = otorgarPermisoEpisodio(req.params.id, actor.ipsId ?? "", targetIps);
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
  if (actor.rol !== "admin_ips") {
    return res.status(403).json({
      code: "FORBIDDEN_ROLE",
      message: "Solo admin_ips puede revocar permisos sobre documentos."
    });
  }
  const targetIps = String(req.body?.targetIpsId ?? "").trim();
  if (!targetIps) {
    return res.status(400).json({
      code: "MISSING_TARGET_IPS",
      message: "Debe enviar targetIpsId."
    });
  }
  const result = revocarPermisoEpisodio(req.params.id, actor.ipsId ?? "", targetIps);
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
  if (!puedeAccederDocumento(req.params.id, actor.ipsId, actor.rol)) {
    return res.status(403).json({
      code: "DOCUMENT_ACCESS_FORBIDDEN",
      message: "No existen permisos válidos para verificar integridad sobre este episodio."
    });
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
  return res.status(200).json({
    code: "OK",
    data: {
      ...lifecycle,
      permisosActivos: listarPermisosEpisodio(req.params.id),
      estadosPermisos: obtenerEstadosPermisosEpisodio(req.params.id),
      traceEvents: listarEventosTrazabilidad({ episodeId: req.params.id })
    }
  });
});
