"use strict";
/**
 * Modelo de datos para RF10 – Registro de auditoría para evaluación de desempeño.
 * Compatible con la salida JSON de pandoras-box y chainhammer.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UMBRALES_DEFAULT = void 0;
/** Umbrales por defecto para semáforos */
exports.UMBRALES_DEFAULT = {
    tpsVerde: 10,
    tpsAmarillo: 5,
    latenciaVerdeMs: 3000,
    latenciaAmarilloMs: 8000,
    tasaExitoVerde: 95,
    tasaExitoAmarillo: 80
};
