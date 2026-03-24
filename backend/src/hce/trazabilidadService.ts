import { randomUUID } from "crypto";
import { existsSync, readFileSync } from "fs";
import path from "path";
import type { ActorContexto } from "./episodioLifecycleService";
import {
  BlockchainTraceError,
  registrarEventoBlockchainReal
} from "../infra/blockchainTraceService";
import { loadJsonFile, saveJsonFile } from "../shared/jsonFileStore";

export type TipoEventoTrazabilidad =
  | "EPISODE_CREATED"
  | "EPISODE_UPDATED"
  | "PERMISSION_GRANTED"
  | "PERMISSION_REVOKED"
  | "AUDITABLE_ACCESS"
  | "INTEGRITY_CHECK";

export interface EvidenciaBlockchain {
  ledgerMode: "real";
  network: string;
  chainId: number;
  contractAddress?: string;
  transactionHash: string;
  explorerUrl?: string;
  emitterId?: string;
  metricsMode?: "measured" | "estimated";
  submittedAt?: string;
  confirmedAt?: string;
  confirmationMs?: number;
  gasUsed?: string;
  gasPriceWei?: string;
  transactionCostWei?: string;
  blockNumber?: number;
}

export interface EventoTrazabilidad {
  traceId: string;
  episodeId: string;
  eventType: TipoEventoTrazabilidad;
  recordedAt: string;
  actor: ActorContexto;
  metadata: Record<string, string | number | boolean | null | undefined>;
  evidence: EvidenciaBlockchain;
}

interface BlockchainDeploymentConfig {
  network: string;
  chainId: number;
  contracts?: {
    InterHCELedger?: string;
  };
}

const TRAZABILIDAD_STORE_FILE = "episodio-trazabilidad.json";
const eventosStore: EventoTrazabilidad[] = loadJsonFile<EventoTrazabilidad[]>(
  TRAZABILIDAD_STORE_FILE,
  []
);

function persistEventosStore(): void {
  saveJsonFile(TRAZABILIDAD_STORE_FILE, eventosStore);
}

function loadDeploymentConfig(): BlockchainDeploymentConfig {
  const filePath = path.resolve(
    __dirname,
    "../../../shared/blockchain/contracts.sepolia.json"
  );
  if (!existsSync(filePath)) {
    return {
      network: "sepolia",
      chainId: 11155111
    };
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as BlockchainDeploymentConfig;
    return {
      network: parsed.network || "sepolia",
      chainId: parsed.chainId || 11155111,
      contracts: parsed.contracts
    };
  } catch {
    return {
      network: "sepolia",
      chainId: 11155111
    };
  }
}

function buildExplorerUrl(network: string, transactionHash: string): string | undefined {
  if (!transactionHash) return undefined;
  if (network === "sepolia") {
    return `https://sepolia.etherscan.io/tx/${transactionHash}`;
  }
  return undefined;
}

export async function registrarEventoTrazabilidad(input: {
  episodeId: string;
  eventType: TipoEventoTrazabilidad;
  actor: ActorContexto;
  metadata?: Record<string, string | number | boolean | null | undefined>;
}): Promise<EventoTrazabilidad> {
  const traceId = randomUUID();
  const recordedAt = new Date().toISOString();
  const metadata = { ...(input.metadata ?? {}) };
  const realReceipt = await registrarEventoBlockchainReal({
    episodeId: input.episodeId,
    eventType: input.eventType,
    actor: input.actor,
    metadata
  });
  if (!realReceipt) {
    const config = loadDeploymentConfig();
    throw new BlockchainTraceError(
      "Blockchain real no disponible para registrar la trazabilidad.",
      {
        network: config.network,
        chainId: config.chainId,
        contractAddress: config.contracts?.InterHCELedger
      }
    );
  }
  const event: EventoTrazabilidad = {
    traceId,
    episodeId: input.episodeId,
    eventType: input.eventType,
    recordedAt,
    actor: { ...input.actor },
    metadata,
    evidence: {
      ledgerMode: "real",
      network: realReceipt.network,
      chainId: realReceipt.chainId,
      contractAddress: realReceipt.contractAddress,
      transactionHash: realReceipt.transactionHash,
      explorerUrl:
        realReceipt.explorerUrl ??
        buildExplorerUrl(realReceipt.network, realReceipt.transactionHash),
      emitterId: realReceipt.emitterId,
      metricsMode: realReceipt.metricsMode,
      submittedAt: realReceipt.submittedAt,
      confirmedAt: realReceipt.confirmedAt,
      confirmationMs: realReceipt.confirmationMs,
      gasUsed: realReceipt.gasUsed,
      gasPriceWei: realReceipt.gasPriceWei,
      transactionCostWei: realReceipt.transactionCostWei,
      blockNumber: realReceipt.blockNumber
    }
  };
  eventosStore.push(event);
  persistEventosStore();
  return {
    ...event,
    actor: { ...event.actor },
    metadata: { ...event.metadata },
    evidence: { ...event.evidence }
  };
}

export function listarEventosTrazabilidad(input?: {
  episodeId?: string;
  eventType?: TipoEventoTrazabilidad;
  ipsId?: string;
}): EventoTrazabilidad[] {
  const episodeId = input?.episodeId?.trim();
  const ipsId = input?.ipsId?.trim();
  return eventosStore
    .filter((item) => {
      if (episodeId && item.episodeId !== episodeId) return false;
      if (input?.eventType && item.eventType !== input.eventType) return false;
      if (ipsId && item.actor.ipsId !== ipsId && item.metadata.targetIpsId !== ipsId) return false;
      return true;
    })
    .map((item) => ({
      ...item,
      actor: { ...item.actor },
      metadata: { ...item.metadata },
      evidence: { ...item.evidence }
    }));
}

export function obtenerUltimoHashRegistradoOnChain(
  episodeId: string
): { documentHash?: string; traceEvent?: EventoTrazabilidad } {
  const events = listarEventosTrazabilidad({ episodeId }).filter(
    (item) =>
      item.eventType === "EPISODE_CREATED" || item.eventType === "EPISODE_UPDATED"
  );
  const last = events[events.length - 1];
  const rawHash = last?.metadata.documentHash;
  return {
    documentHash: typeof rawHash === "string" ? rawHash : undefined,
    traceEvent: last
  };
}
