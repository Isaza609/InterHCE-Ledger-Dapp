## HU6-E5. Gestionar errores y fallos de interacción con la Blockchain

### 1. Objetivo
Asegurar que la DApp y el backend informen fallos de blockchain de forma clara, sin dejar estados inconsistentes ni ambigüedad sobre el resultado de la operación.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU6-E5).
- Las operaciones auditables bloquean su ejecución si no existe configuración real suficiente.
- Las validaciones automatizadas usan `BLOCKCHAIN_TRACE_MODE=mock`; el flujo productivo sigue exigiendo blockchain real.

### 3. Implementación validada
- Backend:
  - `backend/src/routes/episodes.ts`
  - `backend/src/infra/blockchainTraceService.ts`
  - `backend/src/routes/infra.ts`
- Frontend:
  - `frontend/src/shared/services/api.ts`
  - `frontend/src/shared/services/blockchain.ts`
  - `frontend/src/pages/InfraestructuraPage.tsx`

### 4. Casos funcionales
1. El backend devuelve `BLOCKCHAIN_REQUIRED` cuando falta configuración obligatoria.
2. La DApp muestra mensajes de fallo de wallet, red o backend sin ocultar el estado de la operación.
3. La pantalla de infraestructura expone si RPC, firma y contrato están operativos.

### 5. Casos de validación
1. Error de blockchain en backend -> respuesta controlada con detalles de configuración.
2. Cancelación o rechazo en wallet -> mensaje claro al usuario.
3. Fallo al consultar estado de infraestructura -> alerta visible en la DApp.

### 6. Resultado
- Gestión clara de errores de blockchain y wallet: **CUMPLIDO**.
- Prevención de estados inconsistentes ante fallos: **CUMPLIDO**.
- Visibilidad operativa del entorno blockchain: **CUMPLIDO**.

### 7. Evidencia
- Build: `cd backend && npm run build` y `cd frontend && npm run build`.
- Test: `cd backend && npm test`.
- UI: `frontend/src/pages/InfraestructuraPage.tsx` y `frontend/src/shared/services/blockchain.ts`.
