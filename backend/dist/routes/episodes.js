"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodesRouter = void 0;
const crypto_1 = require("crypto");
const express_1 = require("express");
const documentoClinicoService_1 = require("../hce/documentoClinicoService");
const episodioLifecycleService_1 = require("../hce/episodioLifecycleService");
const permisosEpisodioService_1 = require("../hce/permisosEpisodioService");
const trazabilidadService_1 = require("../hce/trazabilidadService");
const autorizacionService_1 = require("../security/autorizacionService");
const accesoUsuariosService_1 = require("../access/accesoUsuariosService");
const validationService_1 = require("../hce/validationService");
const blockchainTraceService_1 = require("../infra/blockchainTraceService");
exports.episodesRouter = (0, express_1.Router)();
function obtenerErrorBlockchainRealtime() {
    const blockchain = (0, blockchainTraceService_1.obtenerConfiguracionBlockchainReal)();
    if (blockchain.enabled)
        return null;
    return {
        status: 503,
        body: {
            code: "BLOCKCHAIN_REQUIRED",
            message: "La operación requiere blockchain real. Configure RPC, firma del backend y dirección del contrato antes de continuar.",
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
function responderErrorBlockchain(res, error) {
    if (!(error instanceof blockchainTraceService_1.BlockchainTraceError))
        return false;
    res.status(503).json({
        code: "BLOCKCHAIN_TRACE_ERROR",
        message: error.message,
        details: error.details
    });
    return true;
}
async function asegurarPropietarioEpisodio(episodeId) {
    const ownerIpsId = (0, permisosEpisodioService_1.obtenerPropietarioEpisodio)(episodeId);
    if (ownerIpsId) {
        return ownerIpsId;
    }
    const lifecycle = (0, episodioLifecycleService_1.obtenerRegistroLifecycleEpisodio)(episodeId);
    const ownerFromLifecycle = lifecycle?.eventoUrgencias.ipsOrigenId?.trim()
        || lifecycle?.creadoPor.ipsId?.trim();
    if (ownerFromLifecycle) {
        (0, permisosEpisodioService_1.registrarPropietarioEpisodio)(episodeId, ownerFromLifecycle);
        return ownerFromLifecycle;
    }
    const almacenado = await (0, documentoClinicoService_1.recuperarDocumentoClinico)(episodeId);
    const ownerFromDocument = almacenado?.document?.prestadorOrigen?.identifier?.[0]?.value?.trim();
    if (ownerFromDocument) {
        (0, permisosEpisodioService_1.registrarPropietarioEpisodio)(episodeId, ownerFromDocument);
        return ownerFromDocument;
    }
    return undefined;
}
function actorPuedeConsultarEpisodio(episodeId, rol, ipsId) {
    return (0, permisosEpisodioService_1.puedeAccederDocumento)(episodeId, ipsId, rol);
}
function actorPuedeConsultarTrazabilidad(episodeId, rol, ipsId) {
    if (rol === "auditor")
        return true;
    const ownerIps = (0, permisosEpisodioService_1.obtenerPropietarioEpisodio)(episodeId);
    if (!ownerIps || !ipsId)
        return false;
    return ownerIps === ipsId || (0, permisosEpisodioService_1.puedeAccederDocumento)(episodeId, ipsId, rol);
}
function actorPuedeVerificarIntegridad(episodeId, rol, ipsId) {
    if (rol === "auditor")
        return true;
    return (0, permisosEpisodioService_1.puedeAccederDocumento)(episodeId, ipsId, rol);
}
function enriquecerResumenParaActor(resumen, rol, ipsId) {
    const ownerIpsId = (0, permisosEpisodioService_1.obtenerPropietarioEpisodio)(resumen.episodeId);
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
function filtrarEpisodiosSegunActor(episodios, rol, ipsId) {
    return episodios
        .filter((item) => actorPuedeConsultarEpisodio(item.episodeId, rol, ipsId))
        .map((item) => enriquecerResumenParaActor(item, rol, ipsId));
}
/** Lista todos los episodios registrados y autorizados para el actor actual. GET /episodes/list */
exports.episodesRouter.get("/list", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para consultar episodios clínicos."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    try {
        const episodios = await (0, documentoClinicoService_1.listarTodosLosEpisodios)();
        const visibles = filtrarEpisodiosSegunActor(episodios, actor.rol, actor.ipsId);
        return res.status(200).json({
            code: "OK",
            message: visibles.length
                ? `Total autorizado: ${visibles.length} episodio(s).`
                : "No hay episodios autorizados para la sesión actual.",
            episodes: visibles
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Error al listar";
        return res.status(502).json({
            code: "LIST_ERROR",
            message: "No se pudieron listar los episodios autorizados.",
            details: message
        });
    }
});
/** Busca episodios autorizados por identificador del paciente (ej. cédula). GET /episodes?patientIdentifier=123 */
exports.episodesRouter.get("/", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para consultar episodios clínicos."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
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
        const episodios = await (0, documentoClinicoService_1.buscarEpisodiosPorIdentificadorPaciente)(patientIdentifier.trim());
        const visibles = filtrarEpisodiosSegunActor(episodios, actor.rol, actor.ipsId);
        return res.status(200).json({
            code: "OK",
            message: visibles.length
                ? `Se encontraron ${visibles.length} episodio(s) autorizados.`
                : "No se encontraron episodios autorizados para este paciente.",
            episodes: visibles
        });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Error al buscar";
        return res.status(502).json({
            code: "SEARCH_ERROR",
            message: "No se pudo buscar por identificador del paciente.",
            details: message
        });
    }
});
exports.episodesRouter.post("/validate", (req, res) => {
    const validation = (0, validationService_1.validateEpisodioClinico)(req.body);
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
exports.episodesRouter.get("/traceability/search", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para consultar trazabilidad."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
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
        ? req.query.eventType.trim()
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
        const events = (0, trazabilidadService_1.listarEventosTrazabilidad)({ episodeId, ...(eventType ? { eventType } : {}) });
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
    let events = (0, trazabilidadService_1.listarEventosTrazabilidad)({
        ...(eventType ? { eventType } : {}),
        ...(actor.rol === "auditor" && ipsId ? { ipsId } : {})
    });
    if (actor.rol !== "auditor") {
        const accesibles = new Set((0, permisosEpisodioService_1.listarEpisodiosAccesiblesPorIps)(actor.ipsId, actor.rol));
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
exports.episodesRouter.post("/", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    const acceso = (0, autorizacionService_1.validarAccesoOperacionClinica)(actor);
    if (!acceso.ok) {
        return res.status(403).json({
            code: acceso.code,
            message: acceso.message
        });
    }
    const actorSeguro = actor;
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actorSeguro);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    const validation = (0, validationService_1.validateEpisodioClinico)(req.body);
    if (!validation.valid) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "El episodio clínico no cumple el modelo de HCE y no puede registrarse.",
            details: validation.issues ?? []
        });
    }
    const episodeId = (0, crypto_1.randomUUID)();
    const documento = (0, documentoClinicoService_1.generarDocumentoClinico)(validation.data);
    const blockchainError = obtenerErrorBlockchainRealtime();
    if (blockchainError) {
        return res.status(blockchainError.status).json(blockchainError.body);
    }
    const ipsPayload = validation.data?.prestadorOrigen?.identifier?.[0]?.value?.trim();
    if (!ipsPayload || actorSeguro.ipsId !== ipsPayload) {
        return res.status(403).json({
            code: "IPS_MISMATCH",
            message: "La IPS del actor (x-ips-id) debe coincidir con la IPS origen del episodio."
        });
    }
    try {
        await (0, documentoClinicoService_1.almacenarDocumentoClinico)(episodeId, documento);
        const onChain = (0, documentoClinicoService_1.generarRegistroOnChainMetadataDesdeDocumento)(episodeId, documento);
        const lifecycle = (0, episodioLifecycleService_1.crearRegistroLifecycleEpisodio)(episodeId, documento, actorSeguro, onChain);
        (0, permisosEpisodioService_1.registrarPropietarioEpisodio)(episodeId, actorSeguro.ipsId ?? "");
        const traceEvent = await (0, trazabilidadService_1.registrarEventoTrazabilidad)({
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
        if (patientId && !(0, accesoUsuariosService_1.buscarUsuarioPorDocumento)(patientId)) {
            const nombre = [
                validation.data?.patient?.name?.[0]?.given?.join(" "),
                validation.data?.patient?.name?.[0]?.family
            ].filter(Boolean).join(" ") || `Paciente ${patientId}`;
            const createResult = (0, accesoUsuariosService_1.crearUsuarioIps)({
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
            message: "Episodio clínico registrado. Documento almacenado off-chain; hash disponible para registro on-chain.",
            episodeId,
            documentHash: onChain.documentHash,
            event: lifecycle.eventoUrgencias,
            version: lifecycle.versionActual,
            onChainMetadata: onChain,
            traceEvent,
            data: validation.data,
            pacienteAutoCreado
        });
    }
    catch (err) {
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
exports.episodesRouter.put("/:id", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    const acceso = (0, autorizacionService_1.validarAccesoOperacionClinica)(actor);
    if (!acceso.ok) {
        return res.status(403).json({
            code: acceso.code,
            message: acceso.message
        });
    }
    const actorSeguro = actor;
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actorSeguro);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    const validation = (0, validationService_1.validateEpisodioClinico)(req.body);
    if (!validation.valid) {
        return res.status(400).json({
            code: "VALIDATION_ERROR",
            message: "El episodio clínico no cumple el modelo de HCE y no puede actualizarse.",
            details: validation.issues ?? []
        });
    }
    const episodeId = req.params.id;
    const documento = (0, documentoClinicoService_1.generarDocumentoClinico)(validation.data);
    const blockchainError = obtenerErrorBlockchainRealtime();
    if (blockchainError) {
        return res.status(blockchainError.status).json(blockchainError.body);
    }
    const precheck = (0, episodioLifecycleService_1.prevalidarActualizacionLifecycleEpisodio)(episodeId, documento, actorSeguro);
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
    const previewOnChain = (0, documentoClinicoService_1.generarRegistroOnChainMetadataDesdeDocumento)(episodeId, documento);
    try {
        await (0, documentoClinicoService_1.almacenarDocumentoClinico)(episodeId, documento);
        const lifecycleUpdated = (0, episodioLifecycleService_1.actualizarRegistroLifecycleEpisodio)(episodeId, documento, actorSeguro, previewOnChain);
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
        const lifecycle = lifecycleUpdated.record;
        const traceEvent = await (0, trazabilidadService_1.registrarEventoTrazabilidad)({
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
            message: "Episodio clínico actualizado. Documento off-chain y hash recalculados.",
            episodeId,
            documentHash: previewOnChain.documentHash,
            version: lifecycle.versionActual,
            event: lifecycle.eventoUrgencias,
            onChainMetadata: previewOnChain,
            traceEvent,
            data: validation.data
        });
    }
    catch (err) {
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
exports.episodesRouter.get("/:id/document", async (req, res) => {
    try {
        const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
        if (!actor) {
            return res.status(403).json({
                code: "MISSING_OR_INVALID_ROLE",
                message: "Debe enviar contexto de actor para acceder a documentos clínicos."
            });
        }
        const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
        if (!userCheck.ok) {
            return res.status(403).json({
                code: userCheck.code,
                message: userCheck.message
            });
        }
        if (!(0, permisosEpisodioService_1.puedeAccederDocumento)(req.params.id, actor.ipsId, actor.rol)) {
            return res.status(403).json({
                code: "DOCUMENT_ACCESS_FORBIDDEN",
                message: "No existen permisos válidos para acceder a este documento clínico."
            });
        }
        const blockchainError = obtenerErrorBlockchainRealtime();
        if (blockchainError) {
            return res.status(blockchainError.status).json(blockchainError.body);
        }
        const almacenado = await (0, documentoClinicoService_1.recuperarDocumentoClinico)(req.params.id);
        if (!almacenado) {
            return res.status(404).json({
                code: "DOCUMENT_NOT_FOUND",
                message: "No existe documento clínico asociado a este episodio."
            });
        }
        const auditTrace = await (0, trazabilidadService_1.registrarEventoTrazabilidad)({
            episodeId: req.params.id,
            eventType: "AUDITABLE_ACCESS",
            actor,
            metadata: {
                sourceIpsId: (0, permisosEpisodioService_1.obtenerPropietarioEpisodio)(req.params.id),
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
    }
    catch (err) {
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
exports.episodesRouter.get("/:id/permissions", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar contexto de actor para consultar permisos."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
    if (!userCheck.ok) {
        return res.status(403).json({
            code: userCheck.code,
            message: userCheck.message
        });
    }
    await asegurarPropietarioEpisodio(req.params.id);
    return res.status(200).json({
        code: "OK",
        permissions: (0, permisosEpisodioService_1.listarPermisosEpisodio)(req.params.id)
    });
});
exports.episodesRouter.post("/:id/permissions/grant", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar contexto de actor para gestionar permisos."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
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
    const blockchainError = obtenerErrorBlockchainRealtime();
    if (blockchainError) {
        return res.status(blockchainError.status).json(blockchainError.body);
    }
    await asegurarPropietarioEpisodio(req.params.id);
    const result = (0, permisosEpisodioService_1.otorgarPermisoEpisodio)(req.params.id, actor.ipsId ?? "", targetIps);
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
        const traceEvent = await (0, trazabilidadService_1.registrarEventoTrazabilidad)({
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
            permissions: (0, permisosEpisodioService_1.listarPermisosEpisodio)(req.params.id),
            traceEvent
        });
    }
    catch (err) {
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
exports.episodesRouter.post("/:id/permissions/revoke", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe enviar contexto de actor para gestionar permisos."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
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
    const blockchainError = obtenerErrorBlockchainRealtime();
    if (blockchainError) {
        return res.status(blockchainError.status).json(blockchainError.body);
    }
    await asegurarPropietarioEpisodio(req.params.id);
    const result = (0, permisosEpisodioService_1.revocarPermisoEpisodio)(req.params.id, actor.ipsId ?? "", targetIps);
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
        const traceEvent = await (0, trazabilidadService_1.registrarEventoTrazabilidad)({
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
            permissions: (0, permisosEpisodioService_1.listarPermisosEpisodio)(req.params.id),
            traceEvent
        });
    }
    catch (err) {
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
exports.episodesRouter.get("/:id/onchain-metadata", async (req, res) => {
    try {
        const metadata = await (0, documentoClinicoService_1.obtenerRegistroOnChainMetadata)(req.params.id);
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
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "Error al construir metadatos on-chain";
        return res.status(502).json({
            code: "ONCHAIN_METADATA_ERROR",
            message: "No se pudieron generar metadatos para registro on-chain.",
            details: message
        });
    }
});
exports.episodesRouter.get("/:id/integrity", async (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para verificar integridad."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
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
        const almacenado = await (0, documentoClinicoService_1.recuperarDocumentoClinico)(req.params.id);
        if (!almacenado) {
            return res.status(404).json({
                code: "DOCUMENT_NOT_FOUND",
                message: "No existe documento clínico asociado a este episodio."
            });
        }
        const onChain = (0, trazabilidadService_1.obtenerUltimoHashRegistradoOnChain)(req.params.id);
        if (!onChain.documentHash || !onChain.traceEvent) {
            return res.status(404).json({
                code: "ONCHAIN_HASH_NOT_FOUND",
                message: "No existe hash registrado en trazabilidad para este episodio."
            });
        }
        const isValid = onChain.documentHash === almacenado.hash;
        const auditTrace = await (0, trazabilidadService_1.registrarEventoTrazabilidad)({
            episodeId: req.params.id,
            eventType: "INTEGRITY_CHECK",
            actor,
            metadata: {
                integrityMatch: isValid,
                sourceIpsId: (0, permisosEpisodioService_1.obtenerPropietarioEpisodio)(req.params.id),
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
    }
    catch (err) {
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
exports.episodesRouter.get("/:id/event", (req, res) => {
    const event = (0, episodioLifecycleService_1.obtenerEventoUrgenciasEpisodio)(req.params.id);
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
exports.episodesRouter.get("/:id/versions", (req, res) => {
    const versions = (0, episodioLifecycleService_1.obtenerVersionesEpisodio)(req.params.id);
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
exports.episodesRouter.get("/:id/traceability", (req, res) => {
    const actor = (0, autorizacionService_1.obtenerActorDesdeRequest)(req);
    if (!actor) {
        return res.status(403).json({
            code: "MISSING_OR_INVALID_ROLE",
            message: "Debe autenticarse para consultar la trazabilidad."
        });
    }
    const userCheck = (0, accesoUsuariosService_1.validarActorContraUsuarios)(actor);
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
    const lifecycle = (0, episodioLifecycleService_1.obtenerRegistroLifecycleEpisodio)(req.params.id);
    if (!lifecycle) {
        return res.status(404).json({
            code: "TRACEABILITY_NOT_FOUND",
            message: "No existe trazabilidad para este episodio."
        });
    }
    const estadosPermisos = (0, permisosEpisodioService_1.obtenerEstadosPermisosEpisodio)(req.params.id);
    const traceEvents = (0, trazabilidadService_1.listarEventosTrazabilidad)({ episodeId: req.params.id });
    const ipsInvolucradas = [...new Set([
            lifecycle.eventoUrgencias.ipsOrigenId,
            ...lifecycle.versiones.map((item) => item.actor.ipsId),
            ...estadosPermisos.map((item) => item.sourceIpsId),
            ...estadosPermisos.map((item) => item.targetIpsId)
        ].filter((item) => Boolean(item?.trim())))].sort((a, b) => a.localeCompare(b));
    return res.status(200).json({
        code: "OK",
        data: {
            ...lifecycle,
            permisosActivos: (0, permisosEpisodioService_1.listarPermisosEpisodio)(req.params.id),
            estadosPermisos,
            traceEvents,
            continuidad: {
                ownerIpsId: (0, permisosEpisodioService_1.obtenerPropietarioEpisodio)(req.params.id),
                ipsInvolucradas
            }
        }
    });
});
