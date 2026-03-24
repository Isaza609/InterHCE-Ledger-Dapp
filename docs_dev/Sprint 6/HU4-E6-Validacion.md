## HU4-E6. Validar el cumplimiento del modelo de HCE y los requisitos del sistema

### 1. Objetivo
Verificar, desde auditoría, si los episodios visibles cumplen el modelo HCE definido y si los requisitos funcionales clave del sistema quedan cubiertos o justificados.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU4-E6).
- La validación usa el esquema estructural ya implementado para episodios clínicos y el contraste contra RF8, RF9, RF10 y RF11.
- Las limitaciones del prototipo se reportan explícitamente en el dashboard.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/validationService.ts`
  - `backend/src/evaluation/prototipoEvaluationService.ts`
  - `backend/src/routes/evaluation.ts`
- Frontend:
  - `frontend/src/pages/EvaluacionPrototipoPage.tsx`

### 4. Casos funcionales
1. El sistema calcula cuántos episodios visibles cumplen la validación estructural del modelo HCE.
2. El dashboard presenta una matriz resumida de requisitos evaluados con estado `cumple`, `parcial` o `pendiente`.
3. Las limitaciones del prototipo se exponen como parte del resultado de validación.

### 5. Casos de validación
1. Cada episodio del dashboard se contrasta con `validateEpisodioClinico`.
2. La evaluación consolida RF8, RF9, RF10 y RF11 con detalle justificativo.
3. Las limitaciones técnicas del entorno se documentan en la salida para análisis académico.

### 6. Resultado
- Validación estructurada del cumplimiento del modelo HCE: **CUMPLIDO**.
- Verificación documentada de requisitos funcionales relevantes: **CUMPLIDO**.
- Identificación clara de limitaciones del prototipo: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd backend && npm run build` y `cd frontend && npm run build`.
- Test: `backend/test/sprint6-hus.test.js`.
- UI: `frontend/src/pages/EvaluacionPrototipoPage.tsx`.
