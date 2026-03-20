## HU2-E4. Registrar la gestión de permisos como eventos de trazabilidad

### 1. Objetivo
Auditar el otorgamiento y la revocación de permisos entre IPS con evidencia inmutable y consultable.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU2-E4).
- La trazabilidad incluye IPS origen, IPS receptora y tipo de cambio.

### 3. Implementación validada
- `backend/src/hce/permisosEpisodioService.ts`
- `backend/src/hce/trazabilidadService.ts`
- `backend/src/routes/episodes.ts`
- `frontend/src/pages/TrazabilidadEpisodioPage.tsx`

### 4. Casos funcionales
1. El otorgamiento genera `PERMISSION_GRANTED`.
2. La revocación genera `PERMISSION_REVOKED`.
3. La consulta de trazabilidad muestra estados históricos y permisos activos.

### 5. Casos de validación
1. Los eventos contienen IPS origen y destino.
2. Los eventos no contienen información clínica sensible.
3. La revocación no borra el historial del permiso.

### 6. Resultado
- Eventos trazables por cada cambio de permiso: **CUMPLIDO**.
- Identificación IPS origen / receptora: **CUMPLIDO**.
- Historial completo no modificable: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint4-hus.test.js`.

