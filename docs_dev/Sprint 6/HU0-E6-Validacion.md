## HU0-E6. Evaluar el flujo de interoperabilidad entre múltiples IPS

### 1. Objetivo
Validar, desde un tablero consolidado, que el prototipo soporta escenarios multi-IPS con continuidad asistencial, permisos controlados y consistencia del episodio clínico.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU0-E6).
- La evaluación toma como evidencia la simulación de IPS, los permisos por episodio, las versiones clínicas y la trazabilidad registrada.
- La validación del sprint se consulta desde el módulo de auditoría del frontend.

### 3. Implementación validada
- Backend:
  - `backend/src/evaluation/prototipoEvaluationService.ts`
  - `backend/src/routes/evaluation.ts`
  - `backend/src/hce/episodioLifecycleService.ts`
  - `backend/src/hce/permisosEpisodioService.ts`
  - `backend/src/infra/infraestructuraService.ts`
- Frontend:
  - `frontend/src/pages/EvaluacionPrototipoPage.tsx`
  - `frontend/src/shared/services/api.ts`
  - `frontend/src/components/layout/Layout.tsx`
  - `frontend/src/pages/PortalClinicoPage.tsx`

### 4. Casos funcionales
1. El sistema consolida escenarios con dos o más IPS involucradas en un mismo episodio.
2. La continuidad entre IPS se identifica a partir de versiones y permisos vigentes del episodio.
3. El auditor visualiza consistencia, integridad y cantidad de escenarios interoperables en una sola vista.

### 5. Casos de validación
1. La simulación multi-IPS se refleja en el dashboard con IPS configuradas y resumen de escenarios.
2. Un episodio continuado por otra IPS aparece marcado con continuidad interinstitucional.
3. La evaluación diferencia escenarios consistentes frente a escenarios con riesgos o evidencia insuficiente.

### 6. Resultado
- Simulación de múltiples IPS operativa: **CUMPLIDO**.
- Verificación del flujo de interoperabilidad con permisos y continuidad: **CUMPLIDO**.
- Visibilidad consolidada para auditoría del comportamiento multi-IPS: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd backend && npm run build` y `cd frontend && npm run build`.
- Test: `cd backend && npm test`.
- UI: `frontend/src/pages/EvaluacionPrototipoPage.tsx`.
