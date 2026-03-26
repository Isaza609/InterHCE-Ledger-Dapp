import { isFhirConfigured } from "../hce/fhirClient";
import { listarEventosTrazabilidad } from "../hce/trazabilidadService";
import { listarIpsActivas } from "../ips/ipsService";
import { obtenerConfiguracionBlockchainReal } from "./blockchainTraceService";

export interface IpsSimulada {
  ipsId: string;
  nombre: string;
  repsCodigo: string;
}

export interface EstadoInfraestructura {
  backend: { status: "ok"; timestamp: string };
  blockchain: {
    red: string;
    chainId: number;
    contratosOperativos: boolean;
    modo: "no_disponible" | "real";
    contractAddress?: string;
    backendSignerConfigured: boolean;
    backendRpcConfigured: boolean;
    rpcReachable?: boolean;
    lastBlockNumber?: number;
    checkedAt?: string;
    healthMessage?: string;
  };
  offChain: {
    fhirConfigurado: boolean;
    almacenamiento: "hapi-fhir" | "memoria";
  };
  simulacionIps: {
    total: number;
    ips: IpsSimulada[];
    multipleIpsActivo: boolean;
  };
  cumpleHu1E5: boolean;
}

const estadoInfra = {
  red: "sepolia",
  chainId: 11155111
};

const ipsSimuladas = new Map<string, IpsSimulada>();

export function configurarIpsSimuladas(
  ips: IpsSimulada[]
): { ok: true; total: number } | { ok: false; message: string } {
  const normalizadas = ips.map((item) => ({
    ipsId: item.ipsId.trim(),
    nombre: item.nombre.trim(),
    repsCodigo: item.repsCodigo.trim()
  }));
  if (normalizadas.some((item) => !item.ipsId || !item.nombre || !item.repsCodigo)) {
    return {
      ok: false,
      message: "Cada IPS simulada debe incluir ipsId, nombre y repsCodigo."
    };
  }
  if (new Set(normalizadas.map((item) => item.ipsId)).size !== normalizadas.length) {
    return {
      ok: false,
      message: "No puede haber ipsId repetidos en la simulación."
    };
  }
  ipsSimuladas.clear();
  for (const item of normalizadas) {
    ipsSimuladas.set(item.ipsId, item);
  }
  return { ok: true, total: ipsSimuladas.size };
}

export function listarIpsSimuladas(): IpsSimulada[] {
  return [...ipsSimuladas.values()];
}

export function obtenerEstadoInfraestructura(): EstadoInfraestructura {
  const fhirConfigurado = isFhirConfigured();
  const blockchainReal = obtenerConfiguracionBlockchainReal();
  const blockchainMode = blockchainReal.enabled ? "real" : "no_disponible";
  const contratosOperativos = blockchainReal.enabled;

  // IPS consolidadas: combinar tres fuentes para reflejar todas las IPS que
  // participan en el sistema, incluyendo aquellas creadas por el seed en un
  // proceso separado (que no sobreviven en el ipsService in-memory):
  //   1. ipsSimuladas: registradas manualmente via POST /infra/ips
  //   2. ipsService: IPS activas (seeds hardcoded IPS-001, IPS-002)
  //   3. Trace events (JSON persistido): descubrir IPS por actor.ipsId y
  //      metadata.targetIpsId — refleja IPS que realmente participaron en
  //      episodios aunque el proceso que las creó ya no esté corriendo.
  const ipsManual = listarIpsSimuladas();
  const ipsRegistradas = listarIpsActivas();
  const ipsMap = new Map<string, IpsSimulada>();
  for (const ips of ipsManual) {
    ipsMap.set(ips.ipsId, ips);
  }
  for (const ips of ipsRegistradas) {
    if (!ipsMap.has(ips.ipsId)) {
      ipsMap.set(ips.ipsId, {
        ipsId: ips.ipsId,
        nombre: ips.nombre,
        repsCodigo: ips.repsCodigo
      });
    }
  }
  // Descubrir IPS adicionales desde los eventos de trazabilidad persistidos.
  // Excluir identificadores de rol (e.g. "AUDITORIA", "SISTEMA") que no son IPS reales.
  const NON_IPS_IDS = new Set(["AUDITORIA", "SISTEMA", "ADMIN"]);
  const traceEvents = listarEventosTrazabilidad();
  for (const event of traceEvents) {
    const actorIps = event.actor.ipsId;
    if (actorIps && !ipsMap.has(actorIps) && !NON_IPS_IDS.has(actorIps)) {
      ipsMap.set(actorIps, {
        ipsId: actorIps,
        nombre: actorIps,
        repsCodigo: actorIps
      });
    }
    const targetIps = event.metadata.targetIpsId;
    if (typeof targetIps === "string" && targetIps && !ipsMap.has(targetIps) && !NON_IPS_IDS.has(targetIps)) {
      ipsMap.set(targetIps, {
        ipsId: targetIps,
        nombre: targetIps,
        repsCodigo: targetIps
      });
    }
  }
  const ipsConsolidadas = [...ipsMap.values()].sort((a, b) => a.ipsId.localeCompare(b.ipsId));

  // RF9 (cumpleHu1E5): la DApp dispone de vistas funcionales si la trazabilidad
  // blockchain está habilitada (modo real o mock) y hay al menos 2 IPS registradas.
  // El requisito evalúa la interfaz, no que la blockchain sea Sepolia real.
  const cumpleHu1E5 = contratosOperativos && ipsConsolidadas.length >= 2;

  return {
    backend: {
      status: "ok",
      timestamp: new Date().toISOString()
    },
    blockchain: {
      red: blockchainReal.network || estadoInfra.red,
      chainId: blockchainReal.chainId || estadoInfra.chainId,
      contratosOperativos,
      modo: blockchainMode,
      contractAddress: blockchainReal.contractAddress,
      backendSignerConfigured: blockchainReal.signerConfigured,
      backendRpcConfigured: blockchainReal.rpcUrlConfigured,
      rpcReachable: undefined,
      lastBlockNumber: undefined,
      checkedAt: undefined,
      healthMessage: undefined
    },
    offChain: {
      fhirConfigurado,
      almacenamiento: fhirConfigurado ? "hapi-fhir" : "memoria"
    },
    simulacionIps: {
      total: ipsConsolidadas.length,
      ips: ipsConsolidadas,
      multipleIpsActivo: ipsConsolidadas.length >= 2
    },
    cumpleHu1E5
  };
}
