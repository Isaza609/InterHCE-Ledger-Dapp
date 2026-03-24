"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registrarPropietarioEpisodio = registrarPropietarioEpisodio;
exports.obtenerPropietarioEpisodio = obtenerPropietarioEpisodio;
exports.obtenerEstadosPermisosEpisodio = obtenerEstadosPermisosEpisodio;
exports.otorgarPermisoEpisodio = otorgarPermisoEpisodio;
exports.revocarPermisoEpisodio = revocarPermisoEpisodio;
exports.puedeAccederDocumento = puedeAccederDocumento;
exports.listarPermisosEpisodio = listarPermisosEpisodio;
exports.actorPuedeActualizarEpisodioConContinuidad = actorPuedeActualizarEpisodioConContinuidad;
exports.listarEpisodiosAccesiblesPorIps = listarEpisodiosAccesiblesPorIps;
const jsonFileStore_1 = require("../shared/jsonFileStore");
const PERMISOS_STORE_FILE = "episodio-permisos.json";
const permisosPorEpisodio = new Map((0, jsonFileStore_1.loadJsonFile)(PERMISOS_STORE_FILE, []).map((item) => [
    item.episodeId,
    {
        ownerIpsId: item.ownerIpsId,
        permissions: new Map(item.permissions.map((permission) => [permission.targetIpsId, permission]))
    }
]));
function persistPermisosStore() {
    const serialized = [...permisosPorEpisodio.entries()].map(([episodeId, registro]) => ({
        episodeId,
        ownerIpsId: registro.ownerIpsId,
        permissions: [...registro.permissions.values()]
    }));
    (0, jsonFileStore_1.saveJsonFile)(PERMISOS_STORE_FILE, serialized);
}
function nowIso() {
    return new Date().toISOString();
}
function getRegistro(episodeId) {
    return permisosPorEpisodio.get(episodeId);
}
function registrarPropietarioEpisodio(episodeId, ipsOwner) {
    const timestamp = nowIso();
    const registro = {
        ownerIpsId: ipsOwner,
        permissions: new Map([
            [
                ipsOwner,
                {
                    episodeId,
                    sourceIpsId: ipsOwner,
                    targetIpsId: ipsOwner,
                    activo: true,
                    grantedAt: timestamp,
                    ultimoCambioEn: timestamp
                }
            ]
        ])
    };
    permisosPorEpisodio.set(episodeId, registro);
    persistPermisosStore();
}
function obtenerPropietarioEpisodio(episodeId) {
    return permisosPorEpisodio.get(episodeId)?.ownerIpsId;
}
function obtenerEstadosPermisosEpisodio(episodeId) {
    const registro = getRegistro(episodeId);
    if (!registro)
        return [];
    return [...registro.permissions.values()]
        .sort((a, b) => a.targetIpsId.localeCompare(b.targetIpsId))
        .map((item) => ({ ...item }));
}
function otorgarPermisoEpisodio(episodeId, actorIps, targetIps) {
    const registro = getRegistro(episodeId);
    if (!registro) {
        return {
            ok: false,
            code: "EPISODE_OWNER_NOT_FOUND",
            message: "No existe información de propiedad IPS para este episodio."
        };
    }
    if (registro.ownerIpsId !== actorIps) {
        return {
            ok: false,
            code: "FORBIDDEN_IPS",
            message: "Solo la IPS propietaria puede otorgar permisos sobre el episodio."
        };
    }
    const existing = registro.permissions.get(targetIps);
    if (existing?.activo) {
        return {
            ok: false,
            code: "PERMISSION_ALREADY_ACTIVE",
            message: "La IPS destino ya tiene un permiso activo sobre este episodio."
        };
    }
    const timestamp = nowIso();
    const permission = {
        episodeId,
        sourceIpsId: registro.ownerIpsId,
        targetIpsId: targetIps,
        activo: true,
        grantedAt: existing?.grantedAt ?? timestamp,
        revokedAt: undefined,
        ultimoCambioEn: timestamp
    };
    registro.permissions.set(targetIps, permission);
    persistPermisosStore();
    return { ok: true, permission: { ...permission } };
}
function revocarPermisoEpisodio(episodeId, actorIps, targetIps) {
    const registro = getRegistro(episodeId);
    if (!registro) {
        return {
            ok: false,
            code: "EPISODE_OWNER_NOT_FOUND",
            message: "No existe información de propiedad IPS para este episodio."
        };
    }
    if (registro.ownerIpsId !== actorIps) {
        return {
            ok: false,
            code: "FORBIDDEN_IPS",
            message: "Solo la IPS propietaria puede revocar permisos sobre el episodio."
        };
    }
    if (registro.ownerIpsId === targetIps) {
        return {
            ok: false,
            code: "OWNER_PERMISSION_IMMUTABLE",
            message: "No se puede revocar el permiso de la IPS propietaria."
        };
    }
    const existing = registro.permissions.get(targetIps);
    if (!existing?.activo) {
        return {
            ok: false,
            code: "PERMISSION_NOT_ACTIVE",
            message: "La IPS destino no tiene un permiso activo para revocar."
        };
    }
    const timestamp = nowIso();
    const permission = {
        ...existing,
        activo: false,
        revokedAt: timestamp,
        ultimoCambioEn: timestamp
    };
    registro.permissions.set(targetIps, permission);
    persistPermisosStore();
    return { ok: true, permission: { ...permission } };
}
function puedeAccederDocumento(episodeId, ipsId, rol) {
    if (rol === "auditor")
        return true;
    if (!ipsId)
        return false;
    const registro = getRegistro(episodeId);
    if (!registro)
        return false;
    const permission = registro.permissions.get(ipsId);
    return Boolean(permission?.activo);
}
function listarPermisosEpisodio(episodeId) {
    return obtenerEstadosPermisosEpisodio(episodeId)
        .filter((item) => item.activo)
        .map((item) => item.targetIpsId);
}
function actorPuedeActualizarEpisodioConContinuidad(episodeId, ipsId, rol) {
    if (rol !== "profesional_salud" && rol !== "admin_ips") {
        return false;
    }
    return puedeAccederDocumento(episodeId, ipsId, rol);
}
function listarEpisodiosAccesiblesPorIps(ipsId, rol) {
    if (rol === "auditor") {
        return [...permisosPorEpisodio.keys()].sort((a, b) => a.localeCompare(b));
    }
    if (!ipsId)
        return [];
    return [...permisosPorEpisodio.entries()]
        .filter(([, registro]) => Boolean(registro.permissions.get(ipsId)?.activo))
        .map(([episodeId]) => episodeId)
        .sort((a, b) => a.localeCompare(b));
}
