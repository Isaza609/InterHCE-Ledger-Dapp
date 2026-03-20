"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prevalidarActualizacionLifecycleEpisodio = prevalidarActualizacionLifecycleEpisodio;
exports.crearRegistroLifecycleEpisodio = crearRegistroLifecycleEpisodio;
exports.actualizarRegistroLifecycleEpisodio = actualizarRegistroLifecycleEpisodio;
exports.obtenerRegistroLifecycleEpisodio = obtenerRegistroLifecycleEpisodio;
exports.obtenerVersionesEpisodio = obtenerVersionesEpisodio;
exports.obtenerEventoUrgenciasEpisodio = obtenerEventoUrgenciasEpisodio;
const lifecycleStore = new Map();
function construirEventoUrgencias(episodeId, documento) {
    const fechaHoraInicio = documento.encounter.period.start;
    const ipsOrigenId = documento.prestadorOrigen.identifier[0]?.value ?? "";
    const tipoAtencion = documento.encounter.class.coding?.[0]?.code ??
        documento.encounter.class.text ??
        "urgencias";
    const eventoUrgenciasId = `${ipsOrigenId}:${fechaHoraInicio}:${episodeId}`;
    return {
        eventoUrgenciasId,
        fechaHoraInicio,
        ipsOrigenId,
        tipoAtencion
    };
}
function validarAsociacionEvento(existente, documento) {
    const fechaInicioActual = documento.encounter.period.start;
    const ipsOrigenActual = documento.prestadorOrigen.identifier[0]?.value ?? "";
    if (existente.fechaHoraInicio !== fechaInicioActual) {
        return "La fecha/hora de inicio del evento de urgencias no puede cambiar en actualizaciones.";
    }
    if (existente.ipsOrigenId !== ipsOrigenActual) {
        return "La IPS origen del evento de urgencias no puede cambiar en actualizaciones.";
    }
    return null;
}
function prevalidarActualizacionLifecycleEpisodio(episodeId, documento, actor) {
    const existente = lifecycleStore.get(episodeId);
    if (!existente) {
        return {
            ok: false,
            error: "El episodio no existe en trazabilidad y no puede actualizarse.",
            errorCode: "EPISODE_NOT_FOUND"
        };
    }
    if (!actor.ipsId || actor.ipsId !== existente.eventoUrgencias.ipsOrigenId) {
        return {
            ok: false,
            error: "La IPS del actor no está autorizada para actualizar este episodio de urgencias.",
            errorCode: "FORBIDDEN_IPS_UPDATE"
        };
    }
    const conflict = validarAsociacionEvento(existente.eventoUrgencias, documento);
    if (conflict) {
        return { ok: false, error: conflict, errorCode: "EVENT_ASSOCIATION_CONFLICT" };
    }
    return { ok: true };
}
function pushVersion(base, actor, onChain) {
    const siguienteVersion = (base.versionActual ?? 0) + 1;
    const version = {
        version: siguienteVersion,
        actualizadoEn: new Date().toISOString(),
        actor,
        documentHash: onChain.documentHash,
        onChain
    };
    return {
        episodeId: base.episodeId,
        eventoUrgencias: base.eventoUrgencias,
        creadoEn: base.creadoEn,
        creadoPor: base.creadoPor,
        versionActual: siguienteVersion,
        versiones: [...(base.versiones ?? []), version]
    };
}
function crearRegistroLifecycleEpisodio(episodeId, documento, actor, onChain) {
    const creadoEn = new Date().toISOString();
    const eventoUrgencias = construirEventoUrgencias(episodeId, documento);
    const record = pushVersion({
        episodeId,
        eventoUrgencias,
        creadoEn,
        creadoPor: actor
    }, actor, onChain);
    lifecycleStore.set(episodeId, record);
    return record;
}
function actualizarRegistroLifecycleEpisodio(episodeId, documento, actor, onChain) {
    const validation = prevalidarActualizacionLifecycleEpisodio(episodeId, documento, actor);
    if (!validation.ok) {
        return {
            error: validation.error,
            errorCode: validation.errorCode
        };
    }
    const existente = lifecycleStore.get(episodeId);
    const actualizado = pushVersion(existente, actor, onChain);
    lifecycleStore.set(episodeId, actualizado);
    return { record: actualizado };
}
function obtenerRegistroLifecycleEpisodio(episodeId) {
    return lifecycleStore.get(episodeId);
}
function obtenerVersionesEpisodio(episodeId) {
    return lifecycleStore.get(episodeId)?.versiones ?? [];
}
function obtenerEventoUrgenciasEpisodio(episodeId) {
    return lifecycleStore.get(episodeId)?.eventoUrgencias;
}
