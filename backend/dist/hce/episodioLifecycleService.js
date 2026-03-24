"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.prevalidarActualizacionLifecycleEpisodio = prevalidarActualizacionLifecycleEpisodio;
exports.crearRegistroLifecycleEpisodio = crearRegistroLifecycleEpisodio;
exports.actualizarRegistroLifecycleEpisodio = actualizarRegistroLifecycleEpisodio;
exports.obtenerRegistroLifecycleEpisodio = obtenerRegistroLifecycleEpisodio;
exports.obtenerVersionesEpisodio = obtenerVersionesEpisodio;
exports.obtenerEventoUrgenciasEpisodio = obtenerEventoUrgenciasEpisodio;
const permisosEpisodioService_1 = require("./permisosEpisodioService");
const jsonFileStore_1 = require("../shared/jsonFileStore");
const LIFECYCLE_STORE_FILE = "episodio-lifecycle.json";
const lifecycleStore = new Map((0, jsonFileStore_1.loadJsonFile)(LIFECYCLE_STORE_FILE, []).map((record) => [
    record.episodeId,
    record
]));
function persistLifecycleStore() {
    (0, jsonFileStore_1.saveJsonFile)(LIFECYCLE_STORE_FILE, [...lifecycleStore.values()]);
}
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
    if (!(0, permisosEpisodioService_1.actorPuedeActualizarEpisodioConContinuidad)(episodeId, actor.ipsId, actor.rol)) {
        return {
            ok: false,
            error: "La IPS del actor no tiene permisos vigentes para continuar este episodio clínico.",
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
    persistLifecycleStore();
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
    persistLifecycleStore();
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
