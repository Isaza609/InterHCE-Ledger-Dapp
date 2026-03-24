import { isFhirConfigured } from "../hce/fhirClient";
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
  const ips = listarIpsSimuladas();
  const fhirConfigurado = isFhirConfigured();
  const blockchainReal = obtenerConfiguracionBlockchainReal();
  const blockchainMode = blockchainReal.enabled ? "real" : "no_disponible";
  const contratosOperativos = blockchainReal.enabled;
  const cumpleHu1E5 = contratosOperativos && ips.length >= 2;
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
      total: ips.length,
      ips,
      multipleIpsActivo: ips.length >= 2
    },
    cumpleHu1E5
  };
}
