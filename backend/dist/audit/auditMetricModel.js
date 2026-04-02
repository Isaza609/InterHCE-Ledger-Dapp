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
 * LATENCIA — Criterios realistas para una red hospitalaria sobre EVM (PoA/PoS):
 *   Ethereum/Sepolia tiene block time ≈ 12 s; en contexto hospitalario se
 *   acepta que una confirmación en ~2 bloques siga siendo óptima y hasta ~5
 *   bloques sea todavía aceptable bajo carga.
 *   - Verde  (óptimo)     : latencia promedio ≤ 30 s  — ~2 bloques EVM
 *   - Amarillo (aceptable): ≤ 60 s                    — aceptable en red hospitalaria
 *   - Rojo   (crítico)    :  > 60 s                   — retrasos o congestión severa
 */
exports.UMBRALES_DEFAULT = {
    tpsVerde: 10,
    tpsAmarillo: 5,
    latenciaVerdeMs: 30000, // ≤ 30 s → contexto hospitalario (~2 bloques EVM)
    latenciaAmarilloMs: 60000, // ≤ 60 s → aceptable para red hospitalaria
    tasaExitoVerde: 95,
    tasaExitoAmarillo: 80
};
