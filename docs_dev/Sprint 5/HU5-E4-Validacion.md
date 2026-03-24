## HU5-E4. Permitir la consulta de trazabilidad por roles autorizados

### 1. Objetivo
Permitir una consulta completa y filtrable de la trazabilidad del sistema para auditoría y supervisión operativa.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU5-E4).
- La consulta soporta filtros por episodio, tipo de evento e IPS.
- Los eventos son verificables y no modificables desde la interfaz.

### 3. Implementación validada
- Backend:
  - `backend/src/routes/episodes.ts` (`GET /episodes/traceability/search`)
  - `backend/src/hce/trazabilidadService.ts`
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`

### 4. Casos funcionales
1. Consulta por episodio devuelve la secuencia completa de eventos.
2. Filtro por tipo devuelve solo eventos homogéneos.
3. Auditor puede acotar por IPS para revisión institucional.

### 5. Casos de validación
1. Los eventos se filtran correctamente por `eventType`.
2. El filtro por IPS incluye actor IPS y destinatario de permiso cuando aplica.
3. La interfaz solo visualiza evidencia, sin opciones de modificación histórica.

### 6. Resultado
- Consulta filtrable de trazabilidad: **CUMPLIDO**.
- Acceso restringido a roles autorizados: **CUMPLIDO**.
- Auditoría verificable sin mutación desde la UI: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint5-hus.test.js`.
- UI: `frontend/src/pages/TrazabilidadEpisodioPage.tsx`.
