/**
 * Modelo de datos para RF10 – Registro de auditoría para evaluación de desempeño.
 * Compatible con la salida JSON de pandoras-box y chainhammer.
 */

export type ModoPrueba = "EOA" | "ERC20" | "ERC721";

/** Salida JSON que produce pandoras-box al finalizar una prueba de estrés */
export interface PandorasBoxOutput {
  // Identificación de la prueba
  mode: ModoPrueba;
  start_time: string;
  end_time: string;
  duration_seconds: number;
  rpc_url: string;
  chain_id: number;

  // Throughput
  total_transactions: number;
  successful_transactions: number;
  failed_transactions: number;
  tps_peak: number;
  tps_average: number;

  // Latencia (ms desde envío hasta confirmación en bloque)
  latency_avg_ms: number;
  latency_min_ms: number;
  latency_max_ms: number;
  latency_p50_ms: number;
  latency_p95_ms: number;
  latency_p99_ms: number;

  // Bloques
  block_time_avg_seconds: number;
  block_time_min_seconds: number;
  block_time_max_seconds: number;
  blocks_observed: number;

  // Gas
  gas_used_avg: number;
  gas_used_max: number;
  gas_limit: number;
  gas_utilization_pct: number;

  // Seguridad / errores
  reverted_transactions: number;
  out_of_gas_transactions: number;
  node_response_avg_ms: number;

  // Interoperabilidad
  contract_address?: string;
  deploy_successful?: boolean;
  erc_function_calls?: number;
  erc_function_success?: number;

  // Datos por bloque para gráficas
  block_samples: BlockSample[];
}

export interface BlockSample {
  block_number: number;
  timestamp: string;
  tx_count: number;
  gas_used: number;
  gas_limit: number;
  block_time_seconds: number;
  tps: number;
}

/** Registro persistido de una evaluación de auditoría */
export interface AuditMetricRecord {
  id: string;
  timestamp: string;
  modo: ModoPrueba;
  rpcUrl: string;
  chainId: number;
  contractAddress?: string;

  // Throughput
  tpsPico: number;
  tpsPromedio: number;
  totalTransacciones: number;
  transaccionesExitosas: number;
  transaccionesFallidas: number;
  tasaExito: number; // 0–100 %

  // Latencia (ms)
  latenciaPromedioMs: number;
  latenciaMinMs: number;
  latenciaMaxMs: number;
  latenciaP95Ms: number;

  // Bloques
  blockTimePromedioSeg: number;
  bloquesObservados: number;

  // Gas
  gasUsadoPromedio: number;
  gasUsadoMax: number;
  gasLimit: number;
  gasUtilizacionPct: number;

  // Seguridad
  transaccionesRevertidas: number;
  transaccionesOutOfGas: number;
  tiempoRespuestaNodoMs: number;

  // Interoperabilidad
  deployExitoso: boolean;
  llamadasERCExitosas: number;
  llamadasERCTotal: number;

  // Semáforos calculados
  semaforoEficiencia: "verde" | "amarillo" | "rojo";
  semaforoLatencia: "verde" | "amarillo" | "rojo";
  semaforoSeguridad: "verde" | "amarillo" | "rojo";
  semaforoInteroperabilidad: "verde" | "amarillo" | "rojo";

  // Serie temporal para gráficas
  blockSamples: BlockSample[];

  // Resultado crudo (JSON completo de pandoras-box o simulación)
  rawOutput: PandorasBoxOutput;

  // Fuente del resultado
  fuente: "pandoras-box" | "simulacion";
}

/** Configuración que el frontend envía para lanzar una prueba */
export interface AuditRunConfig {
  rpcUrl: string;
  modo: ModoPrueba;
  totalTransacciones: number;
  numSubcuentas: number;
  contractAddress?: string;
  /** Mnemonic BIP-39 para pandoras-box (12 palabras). La primera cuenta debe tener ETH. */
  mnemonic?: string;
  /** Tamaño de lote JSON-RPC (default 20) */
  batchSize?: number;
  // Umbrales para semáforos (opcionales, se usan los defaults si no se envían)
  umbralTpsVerde?: number;
  umbralTpsAmarillo?: number;
  umbralLatenciaVerdeMs?: number;
  umbralLatenciaAmarilloMs?: number;
  umbralTasaExitoVerde?: number;
}

/** Umbrales por defecto para semáforos */
export const UMBRALES_DEFAULT = {
  tpsVerde: 10,
  tpsAmarillo: 5,
  latenciaVerdeMs: 3000,
  latenciaAmarilloMs: 8000,
  tasaExitoVerde: 95,
  tasaExitoAmarillo: 80
} as const;
