## HU1-E4. Registrar las actualizaciones de episodios clínicos como eventos de trazabilidad

### 1. Objetivo
Mantener un historial cronológico de actualizaciones del episodio con nuevo hash y sin sobrescribir versiones anteriores.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU1-E4).
- Cada actualización genera una versión nueva y un evento de trazabilidad independiente.

### 3. Implementación validada
- Backend:
  - `backend/src/hce/episodioLifecycleService.ts`
  - `backend/src/hce/trazabilidadService.ts`
  - `backend/src/routes/episodes.ts` (`PUT /episodes/:id`)
- Frontend:
  - `frontend/src/pages/TrazabilidadEpisodioPage.tsx`

### 4. Casos funcionales
1. Actualizar episodio crea versión 2, 3, ... sin perder historial previo.
2. Cada actualización emite `EPISODE_UPDATED`.
3. La vista de trazabilidad muestra el orden cronológico de versiones y eventos.

### 5. Casos de validación
1. Una actualización inválida no debe sobrescribir la asociación del evento de urgencias.
2. El hash de la versión nueva difiere del hash previo cuando cambia el documento.
3. El último hash trazado coincide con el documento actual off-chain.

### 6. Resultado
- Evento independiente por actualización: **CUMPLIDO**.
- Historial no sobrescrito: **CUMPLIDO**.
- Orden cronológico y hash actualizado: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.

