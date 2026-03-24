## HU2-E6. Evaluar el costo y rendimiento de las transacciones Blockchain

### 1. Objetivo
Exponer y documentar métricas de confirmación, gas, costo promedio y emisor técnico por tipo de transacción blockchain relevante para el prototipo.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU2-E6).
- Cuando `BLOCKCHAIN_TRACE_MODE=mock`, el dashboard marca las métricas como estimadas; en modo real se reportan como medidas.
- El análisis se basa en la evidencia registrada por cada evento trazable.

### 3. Implementación validada
- Backend:
  - `backend/src/infra/blockchainTraceService.ts`
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/evaluation/prototipoEvaluationService.ts`
- Frontend:
  - `frontend/src/pages/EvaluacionPrototipoPage.tsx`
  - `frontend/src/shared/types/episodio.ts`

### 4. Casos funcionales
1. Cada evento trazable conserva datos de confirmación, gas, costo y emisor técnico cuando la evidencia lo permite.
2. El dashboard agrupa métricas por tipo de operación blockchain.
3. El auditor identifica la operación más costosa y distingue entre métricas medidas y estimadas.

### 5. Casos de validación
1. La evidencia blockchain incorpora `confirmationMs`, `gasUsed`, `transactionCostWei` y `emitterId`.
2. El análisis del dashboard resume conteo y promedios por tipo de evento.
3. La salida deja explícito si el resultado proviene de blockchain real o de modo mock reproducible.

### 6. Resultado
- Costos y rendimiento de transacciones documentados: **CUMPLIDO**.
- Identificación de operaciones más costosas: **CUMPLIDO**.
- Análisis reproducible según modo de blockchain: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd backend && npm run build`.
- Test: `backend/test/sprint6-hus.test.js`.
- UI: `frontend/src/pages/EvaluacionPrototipoPage.tsx`.
