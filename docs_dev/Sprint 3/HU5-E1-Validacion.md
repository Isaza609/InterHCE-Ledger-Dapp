## HU5-E1. Restringir la creacion y modificacion de episodios segun rol

### 1. Objetivo
Garantizar que solo roles autorizados creen o actualicen episodios clinicos.

### 2. Alcance y supuestos
- Fuente: `docs_plan/3. Epicas e HU.md` (HU5-E1).
- Requisitos: RF1, RF2, RF6, RF11; RNF1.
- Normativa: `docs_plan/5. Referencias Normativas.md`.

### 3. Implementacion validada
- `backend/src/security/autorizacionService.ts`
- `backend/src/routes/episodes.ts` (validacion previa en `POST/PUT /episodes`)
- `backend/src/access/accesoUsuariosService.ts` (usuario activo, rol e IPS consistentes)

### 4. Casos funcionales
1. Profesional de salud crea episodio con IPS valida -> permitido.
2. Profesional de salud actualiza episodio existente -> permitido.

### 5. Casos de validacion
1. Rol paciente intenta crear/actualizar -> `403 FORBIDDEN_ROLE`.
2. Usuario inactivo intenta operar -> `403 USER_INACTIVE`.
3. Rol/IPS inconsistentes contra registro de usuario -> bloqueo.

### 6. Resultado
- Restricciones por rol aplicadas de forma consistente: **CUMPLIDO**.
- Acciones no autorizadas bloqueadas: **CUMPLIDO**.

### 7. Evidencia
- Test: `backend/test/sprint3-hus.test.js` (caso HU1-E3 + HU5-E1).
