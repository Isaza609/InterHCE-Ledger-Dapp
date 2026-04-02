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
