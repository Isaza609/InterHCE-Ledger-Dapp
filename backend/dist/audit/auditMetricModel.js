"use strict";
/**
 * Modelo de datos para RF10 – Registro de auditoría para evaluación de desempeño.
 * Compatible con la salida JSON de pandoras-box y chainhammer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UMBRALES_DEFAULT = void 0;
/**
 * Umbrales por defecto para semáforos.
 *
 * LATENCIA — Criterios realistas para redes EVM (PoA/PoS):
 *   Ethereum/Sepolia tiene block time ≈ 12 s; una transacción tarda al menos
 *   un bloque en confirmarse (~13–15 s bajo carga normal).  Por eso los
 *   umbrales de "verde" y "amarillo" se sitúan en 15 000 ms y 30 000 ms
 *   respectivamente, en lugar de los 3 s/8 s propios de sistemas REST.
 *   - Verde  (óptimo)   : latencia promedio ≤ 15 s  — 1 bloque típico
 *   - Amarillo (aceptable): ≤ 30 s                   — hasta ~2 bloques
 *   - Rojo   (crítico)  :  > 30 s                   — retrasos o congestión
 */
exports.UMBRALES_DEFAULT = {
    tpsVerde: 10,
    tpsAmarillo: 5,
    latenciaVerdeMs: 15000, // ≤ 15 s → 1 bloque normal (PoA/PoS ~12 s)
    latenciaAmarilloMs: 30000, // ≤ 30 s → hasta 2 bloques bajo carga
    tasaExitoVerde: 95,
    tasaExitoAmarillo: 80
};
