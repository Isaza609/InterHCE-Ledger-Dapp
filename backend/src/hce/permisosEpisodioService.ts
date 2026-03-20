export interface EstadoPermisoEpisodio {
  episodeId: string;
  sourceIpsId: string;
  targetIpsId: string;
  activo: boolean;
  grantedAt?: string;
  revokedAt?: string;
  ultimoCambioEn: string;
}

interface RegistroPermisosEpisodio {
  ownerIpsId: string;
  permissions: Map<string, EstadoPermisoEpisodio>;
}

const permisosPorEpisodio = new Map<string, RegistroPermisosEpisodio>();

function nowIso(): string {
  return new Date().toISOString();
}

function getRegistro(episodeId: string): RegistroPermisosEpisodio | undefined {
  return permisosPorEpisodio.get(episodeId);
}

export function registrarPropietarioEpisodio(
  episodeId: string,
  ipsOwner: string
): void {
  const timestamp = nowIso();
  const registro: RegistroPermisosEpisodio = {
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
}

export function obtenerPropietarioEpisodio(episodeId: string): string | undefined {
  return permisosPorEpisodio.get(episodeId)?.ownerIpsId;
}

export function obtenerEstadosPermisosEpisodio(
  episodeId: string
): EstadoPermisoEpisodio[] {
  const registro = getRegistro(episodeId);
  if (!registro) return [];
  return [...registro.permissions.values()]
    .sort((a, b) => a.targetIpsId.localeCompare(b.targetIpsId))
    .map((item) => ({ ...item }));
}

export function otorgarPermisoEpisodio(
  episodeId: string,
  actorIps: string,
  targetIps: string
): { ok: true; permission: EstadoPermisoEpisodio } | { ok: false; code: string; message: string } {
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
  const permission: EstadoPermisoEpisodio = {
    episodeId,
    sourceIpsId: registro.ownerIpsId,
    targetIpsId: targetIps,
    activo: true,
    grantedAt: existing?.grantedAt ?? timestamp,
    revokedAt: undefined,
    ultimoCambioEn: timestamp
  };
  registro.permissions.set(targetIps, permission);
  return { ok: true, permission: { ...permission } };
}

export function revocarPermisoEpisodio(
  episodeId: string,
  actorIps: string,
  targetIps: string
): { ok: true; permission: EstadoPermisoEpisodio } | { ok: false; code: string; message: string } {
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
  const permission: EstadoPermisoEpisodio = {
    ...existing,
    activo: false,
    revokedAt: timestamp,
    ultimoCambioEn: timestamp
  };
  registro.permissions.set(targetIps, permission);
  return { ok: true, permission: { ...permission } };
}

export function puedeAccederDocumento(
  episodeId: string,
  ipsId?: string,
  rol?: string
): boolean {
  if (rol === "auditor") return true;
  if (!ipsId) return false;
  const registro = getRegistro(episodeId);
  if (!registro) return false;
  const permission = registro.permissions.get(ipsId);
  return Boolean(permission?.activo);
}

export function listarPermisosEpisodio(episodeId: string): string[] {
  return obtenerEstadosPermisosEpisodio(episodeId)
    .filter((item) => item.activo)
    .map((item) => item.targetIpsId);
}
