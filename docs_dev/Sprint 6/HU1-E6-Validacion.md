## HU1-E6. Medir tiempos de acceso y verificación de información clínica

### 1. Objetivo
Medir de forma objetiva los tiempos de consulta de metadatos, acceso a documento clínico y verificación de integridad dentro del prototipo.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU1-E6).
- Las mediciones se ejecutan sobre episodios visibles con evidencia disponible.
- Los tiempos reportados representan el comportamiento del prototipo actual (memoria o HAPI FHIR, según configuración).

### 3. Implementación validada
- Backend:
  - `backend/src/evaluation/prototipoEvaluationService.ts`
  - `backend/src/hce/documentoClinicoService.ts`
  - `backend/src/hce/trazabilidadService.ts`
- Frontend:
  - `frontend/src/pages/EvaluacionPrototipoPage.tsx`
  - `frontend/src/shared/services/api.ts`

### 4. Casos funcionales
1. El sistema mide tiempos de consulta de metadatos on-chain derivados del episodio.
2. El sistema mide tiempos de acceso al documento clínico off-chain.
3. El sistema mide tiempos de verificación de integridad y reporta consistencia estadística.

### 5. Casos de validación
1. El dashboard presenta promedios, mínimos, máximos y desviación estándar por tipo de operación.
2. Las métricas se calculan sobre múltiples ejecuciones comparables (`runs`) por episodio.
3. El auditor puede contrastar si la consistencia de las mediciones es alta, media o baja.

### 6. Resultado
- Medición objetiva de tiempos de acceso y verificación: **CUMPLIDO**.
- Registro estructurado de resultados comparables: **CUMPLIDO**.
- Evidencia suficiente para analizar viabilidad del prototipo: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd backend && npm run build` y `cd frontend && npm run build`.
- Test: `backend/test/sprint6-hus.test.js`.
- UI: `frontend/src/pages/EvaluacionPrototipoPage.tsx`.
