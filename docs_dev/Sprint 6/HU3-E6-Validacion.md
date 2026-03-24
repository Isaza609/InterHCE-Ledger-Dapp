## HU3-E6. Validar la integridad y trazabilidad del sistema

### 1. Objetivo
Permitir al auditor contrastar eventos, hashes, historial de versiones y coherencia on-chain/off-chain desde una vista de evaluación consolidada.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU3-E6).
- El rol auditor conserva acceso a la evidencia sin exponer documento clínico sensible.
- La validación toma como base los eventos de trazabilidad, la última evidencia hash y el lifecycle del episodio.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/evaluation/prototipoEvaluationService.ts`
  - `backend/src/routes/evaluation.ts`
- Frontend:
  - `frontend/src/pages/EvaluacionPrototipoPage.tsx`
  - `frontend/src/shared/auth/capabilities.ts`

### 4. Casos funcionales
1. El auditor visualiza cantidad total de eventos, actores observados y cobertura de trazabilidad extremo a extremo.
2. El sistema identifica episodios con integridad válida o con revisión pendiente.
3. El historial de versiones y los hallazgos quedan estructurados para auditoría.

### 5. Casos de validación
1. El dashboard contrasta hash documental actual contra la última evidencia registrada.
2. Los actores observados se agrupan por rol e IPS sin exponer contenido clínico.
3. Los episodios con inconsistencias o evidencia insuficiente quedan listados como hallazgos.

### 6. Resultado
- Auditoría de trazabilidad e integridad extremo a extremo: **CUMPLIDO**.
- Historial de versiones y evidencia verificable disponibles para auditoría: **CUMPLIDO**.
- Detección explícita de hallazgos de revisión: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd backend && npm run build` y `cd frontend && npm run build`.
- Test: `backend/test/sprint6-hus.test.js`.
- UI: `frontend/src/pages/EvaluacionPrototipoPage.tsx`.
