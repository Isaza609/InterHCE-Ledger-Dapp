## HU0-E4. Registrar la creación de episodios clínicos como eventos de trazabilidad

### 1. Objetivo
Emitir un evento de trazabilidad por cada creación de episodio, asociado al identificador único y sin datos clínicos sensibles.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU0-E4).
- La evidencia on-chain del prototipo se modela con `traceEvent` inmutable y `transactionHash`.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/routes/episodes.ts` (`POST /episodes`)
- Frontend:
  - `frontend/src/features/episodios/components/FormularioEpisodio.tsx`

### 4. Casos funcionales
1. Crear episodio genera `EPISODE_CREATED`.
2. El evento queda asociado al `episodeId` y al `eventId` de urgencias.
3. La respuesta muestra el hash documental y la traza correspondiente.

### 5. Casos de validación
1. El evento conserva `documentHash`, `sourceIpsId` y versión sin exponer el documento.
2. El historial consultable por episodio incluye la creación.

### 6. Resultado
- Evento de creación por episodio: **CUMPLIDO**.
- Asociación al identificador único: **CUMPLIDO**.
- Inmutabilidad verificable del evento: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.

