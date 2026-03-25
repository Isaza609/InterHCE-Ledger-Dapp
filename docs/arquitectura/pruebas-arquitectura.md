# Arquitectura del módulo de evaluación y pruebas

Este documento describe cómo funciona el módulo de evaluación de desempeño
(RF10) de InterHCE Ledger: pandoras-box, recolección de métricas, persistencia
y visualización en el dashboard del auditor.

---

## 1. Visión general del módulo de evaluación

El módulo tiene dos subsistemas independientes:

| Subsistema | Qué mide | Endpoint |
|---|---|---|
| **Sección A — Pruebas de estrés de red** | Rendimiento de la red blockchain: TPS, latencia de confirmación, gas, tasa de éxito | `POST /audit/run`, `GET /audit/metrics` |
| **Sección B — Evaluación de interoperabilidad clínica** | Cómo la DApp gestiona episodios entre múltiples IPS: continuidad, integridad, tiempos de acceso | `GET /evaluation/dashboard` |

---

## 2. Flujo de una prueba de estrés (Sección A)

```mermaid
sequenceDiagram
    participant AUDIT as Auditor (UI)
    participant API as Backend /audit/run
    participant PB as pandorasBoxAdapter
    participant PANDA as pandoras-box (binario)
    participant RPC as Nodo EVM (RPC)
    participant STORE as audit-metrics.json

    AUDIT->>API: POST /audit/run {rpcUrl, modo, totalTransacciones, mnemonic?}
    API->>PB: ejecutarPrueba(config)
    PB->>RPC: eth_chainId, eth_blockNumber (siempre)

    alt mnemonic disponible y pandoras-box instalado
        PB->>PANDA: pandoras-box -url ... -m ... -t ... --mode ...
        PANDA->>RPC: envía N transacciones reales
        PANDA-->>PB: result.json {averageTPS, blocks[]}
        PB->>PB: parsearSalidaReal() → PandorasBoxOutput
        Note over PB: fuente = "pandoras-box"
    else sin mnemonic o pandoras-box no instalado
        PB->>RPC: eth_getBlockByNumber (últimos 10 bloques)
        RPC-->>PB: datos reales de bloques
        PB->>PB: buildSimulation() con parámetros del chainId
        Note over PB: fuente = "simulacion"
    end

    PB-->>API: {output: PandorasBoxOutput, fuente}
    API->>API: convertirASalida() → AuditMetricRecord
    API->>API: calcular semáforos (eficiencia, latencia, seguridad, interoperabilidad)
    API->>STORE: append → audit-metrics.json
    API-->>AUDIT: {record, fuente, advertencia?}
```

---

## 3. Lógica de semáforos

| Semáforo | Verde | Amarillo | Rojo |
|---|---|---|---|
| **Eficiencia (TPS)** | TPS promedio ≥ 10 | ≥ 5 | < 5 |
| **Latencia** | ≤ 15 000 ms (~1 bloque EVM) | ≤ 30 000 ms (~2 bloques) | > 30 000 ms |
| **Seguridad** | tasa de éxito ≥ 95 % | ≥ 80 % | < 80 % |
| **Interoperabilidad** | nodo accesible + contrato activo + lecturas/escrituras OK | nodo accesible, sin contrato (EOA) o llamadas ERC < 95 % | nodo no responde o deploy fallido |

Los umbrales de latencia se fijaron en 15 s/30 s porque Ethereum/Sepolia (PoS)
tiene un block time de ≈ 12 s.  Un valor de "verde" de 3 s sería inalcanzable
en cualquier red EVM real, generando falsos negativos permanentes.

---

## 4. Flujo de evaluación de interoperabilidad clínica (Sección B)

```mermaid
sequenceDiagram
    participant AUDIT as Auditor (UI)
    participant API as Backend /evaluation/dashboard
    participant EVS as prototipoEvaluationService
    participant DOC as documentoClinicoService
    participant TRA as trazabilidadService
    participant LC as episodioLifecycleService
    participant PERM as permisosEpisodioService

    AUDIT->>API: GET /evaluation/dashboard?runs=3
    API->>EVS: generarDashboardEvaluacionPrototipo({runs: 3})

    EVS->>DOC: listarTodosLosEpisodios()
    EVS->>TRA: listarEventosTrazabilidad()

    loop Por cada episodio (máx 5 para medición de tiempos)
        EVS->>DOC: obtenerRegistroOnChainMetadata(episodeId)  ← mide tiempo
        EVS->>DOC: recuperarDocumentoClinico(episodeId)       ← mide tiempo
        EVS->>DOC: obtenerHashEpisodio(episodeId)             ← mide tiempo
        EVS->>TRA: obtenerUltimoHashRegistradoOnChain(episodeId)
        EVS->>LC: obtenerRegistroLifecycleEpisodio(episodeId)
        EVS->>PERM: obtenerEstadosPermisosEpisodio(episodeId)
    end

    EVS->>EVS: calcular interoperabilidad, tiempos, blockchain performance, cumplimiento HCE
    EVS-->>API: DashboardEvaluacionPrototipo
    API-->>AUDIT: dashboard completo (JSON)
```

---

## 5. Estructura del dashboard de evaluación

```
DashboardEvaluacionPrototipo
├── overview              — totales: episodios, trazas, IPS, modo blockchain
├── interoperability      — escenarios multi-IPS, continuidad, permisos
│   └── scenarios[]       — detalle por episodio: IPS involucradas, integridad, consistencia
├── timings               — tiempos medidos (N runs × M episodios)
│   └── operations
│       ├── metadataOnChain      — lectura de trazabilidad / contrato
│       ├── documentOffChain     — recuperación desde FHIR
│       └── integrityVerification — cálculo hash + comparación
├── blockchainPerformance — operaciones por tipo (EPISODE_CREATED, etc.), gas, costo
├── audit                 — eventos de trazabilidad, actores, episodios íntegros
└── compliance            — cumplimiento HCE (RF8, RF9, RF10, RF11), limitaciones
```

---

## 6. Sesiones de evaluación

Para aislar métricas entre sesiones de prueba sin borrar el historial completo,
el sistema soporta **snapshots de sesión**:

```mermaid
sequenceDiagram
    participant AUDIT as Auditor
    participant API as Backend /audit/session
    participant SS as evaluacionSesionService
    participant STORE as evaluacion-sesion.json

    AUDIT->>API: POST /audit/session/reset
    API->>SS: iniciarNuevaSesion()
    SS->>STORE: {id, startedAt, startBlockRef?, label}
    SS-->>API: sesion creada
    API-->>AUDIT: {sesionId, startedAt}

    AUDIT->>API: GET /audit/metrics?sesionId=<id>
    API->>SS: obtenerSesionActual()
    SS-->>API: {startedAt}
    API->>API: filtrar métricas con timestamp >= startedAt
    API-->>AUDIT: métricas de esta sesión
```

---

## 7. Script de población de datos demo

`backend/scripts/seed-evaluacion-demo.ts` genera datos sintéticos para poblar
el sistema antes de ejecutar la evaluación:

```mermaid
flowchart TD
    START([seed-evaluacion-demo.ts]) --> IPS[Crea IPS-003…IPS-006 si no existen]
    IPS --> USERS[Crea admins y profesionales por IPS]
    USERS --> PATIENTS[Crea pacientes con CC estables 103500xxxx]
    PATIENTS --> EP1[Crea episodio base en IPS aleatoria\nEPISODE_CREATED + registro blockchain mock]
    EP1 --> PERM{SEED_GRANT_PERMS?}
    PERM -->|Sí| GRANT[Otorga permiso a IPS vecina\nPERMISSION_GRANTED]
    PERM -->|No| SKIP1[omitir]
    EP1 --> EP2{SEED_SECOND_EPISODE?}
    EP2 -->|Sí| EP2C[Crea segundo episodio en otra IPS\nEPISODE_UPDATED]
    EP2 -->|No| SKIP2[omitir]
    GRANT --> EXTRA{SEED_ALL_TRACE_EVENTS?}
    EP2C --> EXTRA
    EXTRA -->|Sí| TRACE[Registra AUDITABLE_ACCESS\nINTEGRITY_CHECK\nPERMISSION_REVOKED opcional]
    EXTRA -->|No| SKIP3[omitir]
    TRACE --> END([fin])
    SKIP1 --> END
    SKIP2 --> END
    SKIP3 --> END
```

### Variables de entorno del script

| Variable | Default | Descripción |
|---|---|---|
| `SEED_NUM_PATIENTS` | `18` | Número de pacientes a crear |
| `SEED_SECOND_EPISODE` | `1` | `0` desactiva segundo episodio |
| `SEED_GRANT_PERMS` | `1` | `0` omite permisos cruzados |
| `SEED_ALL_TRACE_EVENTS` | `1` | `0` omite trazas adicionales |
| `SEED_DOCUMENT_OFFSET` | `0` | Offset para CC de pacientes (evita colisiones entre laboratorios) |
| `BLOCKCHAIN_TRACE_MODE` | — | `mock` para no requerir nodo real |

---

## 8. Persistencia de métricas

| Archivo | Contenido | Servicio |
|---|---|---|
| `backend/data/audit-metrics.json` | Historial de evaluaciones de estrés | `auditMetricsService.ts` |
| `backend/data/evaluacion-sesion.json` | Sesiones de evaluación activas (snapshots) | `evaluacionSesionService.ts` |
| `backend/data/episodio-trazabilidad.json` | Eventos de trazabilidad por episodio | `trazabilidadService.ts` |
| `backend/data/episodio-lifecycle.json` | Versiones y lifecycle de episodios | `episodioLifecycleService.ts` |
| `backend/data/episodio-permisos.json` | Permisos entre IPS | `permisosEpisodioService.ts` |

---

## 9. Archivos clave del módulo de evaluación

| Propósito | Archivo |
|---|---|
| Adaptador pandoras-box / simulación | `backend/src/audit/pandorasBoxAdapter.ts` |
| Modelo de datos de auditoría | `backend/src/audit/auditMetricModel.ts` |
| Servicio de métricas y semáforos | `backend/src/audit/auditMetricsService.ts` |
| Servicio de sesiones de evaluación | `backend/src/audit/evaluacionSesionService.ts` |
| Dashboard de interoperabilidad clínica | `backend/src/evaluation/prototipoEvaluationService.ts` |
| Rutas REST de auditoría | `backend/src/routes/audit.ts` |
| Rutas REST de evaluación | `backend/src/routes/evaluation.ts` |
| Vista auditor — Sección A y B | `frontend/src/pages/AuditoriaDashboardPage.tsx` |
| Vista evaluación prototipo | `frontend/src/pages/EvaluacionPrototipoPage.tsx` |
| Script de datos demo | `backend/scripts/seed-evaluacion-demo.ts` |
| Script de reset de datos | `backend/scripts/reset-demo-data.ts` |
