/**
 * Modelo de datos para RF10 – Registro de auditoría para evaluación de desempeño.
 * Compatible con la salida JSON de pandoras-box y chainhammer.
 */

export type ModoPrueba = "EOA" | "ERC20" | "ERC721";
export type TipoOperacionAudit =
  | "EOA_TRANSFER"
  | "ERC20_TRANSFER"
  | "ERC20_APPROVE"
  | "ERC721_MINT"
  | "ERC721_TRANSFER"
  | "DESCONOCIDA";

export type CategoriaErrorEnvio =
  | "nonce_too_low"
  | "replacement_underpriced"
  | "already_known"
  | "rate_limit"
  | "rpc_transport"
  | "unknown_send";

export type CategoriaErrorEjecucion =
  | "revert"
  | "out_of_gas"
  | "execution_failed_unknown"
  | "receipt_timeout";

export interface AuditTxMetric {
  tx_hash?: string;
  local_hash?: string;
  from: string;
  to?: string;
  nonce: number;
  operation_type: TipoOperacionAudit;
  sent_at?: string;
  block_number?: number;
  block_timestamp?: string;
  latency_ms?: number;
  receipt_status?: number;
  gas_used?: number;
  effective_gas_price_wei?: string;
  rpc_response_ms?: number;
  status: "failed_send" | "sent" | "confirmed" | "failed_execution" | "receipt_timeout";
  send_error_type?: CategoriaErrorEnvio;
  send_error_message?: string;
  execution_error_type?: CategoriaErrorEjecucion;
  execution_error_message?: string;
  event_valid?: boolean;
  state_valid?: boolean;
}

export interface OperationMetricsBreakdown {
  operation_type: TipoOperacionAudit;
  total_transactions: number;
  confirmed_transactions: number;
  successful_transactions: number;
  success_rate: number;
  latency_avg_ms: number;
  latency_p95_ms: number;
  gas_used_avg: number;
  gas_used_max: number;
}

export interface AuditErrorBreakdown {
  send: Record<CategoriaErrorEnvio, number>;
  execution: Record<CategoriaErrorEjecucion, number>;
}

export interface PandoraReportedMetrics {
  tps_average: number;
  blocks_observed: number;
  average_block_gas_utilization_pct: number;
  notes: string[];
}

export interface MeasurementComparison {
  real_tps_average: number;
  pandora_tps_average: number;
  tps_delta: number;
  tps_delta_pct: number | null;
  no_usar_metricas_pandora: string[];
}

export interface InteroperabilityChecks {
  total_contract_calls: number;
  successful_contract_calls: number;
  event_checks_ok: number;
  state_checks_ok: number;
  unsupported_operations: TipoOperacionAudit[];
  notes: string[];
}

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
  operation_breakdown?: OperationMetricsBreakdown[];
  tx_metrics?: AuditTxMetric[];
  error_breakdown?: AuditErrorBreakdown;
  pandora_reported_metrics?: PandoraReportedMetrics;
  measurement_comparison?: MeasurementComparison;
  interoperability_checks?: InteroperabilityChecks;
  metric_notes?: string[];

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
  /** ID de la sesión de evaluación a la que pertenece este registro (si se inició una) */
  sesionId?: string;
  /** ID compartido por las 3 corridas de una prueba comparativa batch */
  batchId?: string;
  modo: ModoPrueba;
  rpcUrl: string;
  chainId: number;
  contractAddress?: string;

  // Throughput
  tpsPico: number;
  tpsPromedio: number;
  totalTransacciones?: number;
  transaccionesExitosas: number;
  transaccionesFallidas: number;
  tasaExito: number; // 0–100 %

  // Latencia (ms)
  latenciaPromedioMs: number;
  latenciaMinMs: number;
  latenciaMaxMs: number;
  latenciaP50Ms?: number;
  latenciaP95Ms: number;
  latenciaP99Ms?: number;

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
  /**
   * Detalles de interoperabilidad HCE.
   *
   * "Interoperabilidad" en este contexto no es solo ERC20/ERC721 — significa que
   * el nodo EVM responde correctamente a llamadas de lectura (view) y escritura,
   * y que el contrato InterHCELedger o el contrato de prueba es accesible desde
   * distintos actores/IPS.  Se registra también chainId y rpcUrl para confirmar
   * que la prueba se realizó contra la red esperada.
   */
  interoperabilityDetails: {
    chainId: number;
    rpcUrl: string;
    nodoAccesible: boolean;       // El nodo respondió eth_chainId correctamente
    contratoAccesible: boolean;   // Se pudo consultar el contrato (deploy OK o ABI)
    readCallsOk: boolean;         // Llamadas view/read respondieron sin error
    writeCallsOk: boolean;        // Transacciones de escritura se confirmaron
    compatibilidadERC: string;    // "EOA", "ERC20", "ERC721" o "InterHCELedger"
    nota: string;                 // Descripción legible del resultado
  };

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
  fuente: "pandoras-box" | "pandoras-box-recovery" | "simulacion";
}

/** Configuración que el frontend envía para lanzar una prueba */
export interface AuditRunConfig {
  /**
   * URL del nodo RPC resuelta en el backend.
   * El cliente no debe enviarla; el adaptador usa process.env.ALCHEMY_RPC_URL
   * (o SEPOLIA_RPC_URL por compatibilidad legado). Si no existe, se usa simulación.
   */
  rpcUrl?: string;
  modo: ModoPrueba;
  totalTransacciones: number;
  numSubcuentas: number;
  contractAddress?: string;
  /**
   * Mnemonic BIP-39 resuelto en el backend.
   * El cliente no debe enviarlo; el adaptador usa process.env.MNEMONIC
   * (o PANDORAS_MNEMONIC por compatibilidad legado).
   */
  mnemonic?: string;
  /** Tamaño de lote JSON-RPC. Para Sepolia/Alchemy el default seguro es 10. */
  batchSize?: number;
  /** Espera entre lotes de envío para evitar rate limit del RPC. */
  batchDelayMs?: number;
  /** Timeout total para recolectar recibos mediante polling. */
  receiptTimeoutMs?: number;
  /** Máximo de reintentos por rate limit / replacement bajo un mismo nonce. */
  maxRetriesPorTransaccion?: number;
  // Umbrales para semáforos (opcionales, se usan los defaults si no se envían)
  umbralTpsVerde?: number;
  umbralTpsAmarillo?: number;
  umbralLatenciaVerdeMs?: number;
  umbralLatenciaAmarilloMs?: number;
  umbralTasaExitoVerde?: number;
}

export type AuditRunResolvedConfig = AuditRunConfig & {
  rpcUrl: string;
  totalTransacciones: number;
  numSubcuentas: number;
  batchSize: number;
  mnemonic?: string;
};

/**
 * Umbrales por defecto para semáforos.
 *
 * LATENCIA — Criterios realistas para una red hospitalaria sobre EVM (PoA/PoS):
 *   Ethereum/Sepolia tiene block time ≈ 12 s; en contexto hospitalario se
 *   acepta que una confirmación en ~2 bloques siga siendo óptima y hasta ~5
 *   bloques sea todavía aceptable bajo carga.
 *   - Verde  (óptimo)     : latencia promedio ≤ 30 s  — ~2 bloques EVM
 *   - Amarillo (aceptable): ≤ 60 s                    — aceptable en red hospitalaria
 *   - Rojo   (crítico)    :  > 60 s                   — retrasos o congestión severa
 */
export const UMBRALES_DEFAULT = {
  tpsVerde: 10,
  tpsAmarillo: 5,
  latenciaVerdeMs: 30_000,   // ≤ 30 s → contexto hospitalario (~2 bloques EVM)
  latenciaAmarilloMs: 60_000, // ≤ 60 s → aceptable para red hospitalaria
  tasaExitoVerde: 95,
  tasaExitoAmarillo: 80
} as const;
