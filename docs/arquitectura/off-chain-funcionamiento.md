# Como funciona la arquitectura off-chain en este proyecto

Este documento explica como se maneja la informacion fuera de la blockchain en InterHCE Ledger, cuales componentes participan y que datos se guardan en cada capa.

## 1. Idea principal

La arquitectura off-chain es la parte del sistema que guarda y procesa la informacion clinica real.

Su objetivo es:

- almacenar el documento clinico completo,
- mantener los recursos interoperables en formato FHIR,
- permitir consultas, busquedas y actualizaciones,
- conservar el estado funcional que la app necesita para operar,
- entregar al modulo blockchain solo hashes y metadatos no sensibles.

En otras palabras:

- **off-chain** = dato clinico operativo y estado del sistema,
- **on-chain** = evidencia, integridad y trazabilidad.

### Comparacion rapida: off-chain vs on-chain

| Aspecto | Off-chain | On-chain |
|---|---|---|
| Que guarda | Documento clinico completo, recursos FHIR, permisos y estado funcional | Hashes, metadatos no sensibles y evidencia |
| Donde vive | Backend, HAPI FHIR, PostgreSQL y `backend/data/` | Contrato `InterHCELedger` en Sepolia |
| Para que sirve | Operacion clinica diaria, consulta, busqueda y actualizacion | Integridad, auditoria y trazabilidad verificable |
| Tipo de dato | Clinico y operativo | Minimo, resumido y no sensible |
| Costo de uso | Bajo para lectura/escritura frecuente | Mayor, porque requiere transacciones |
| Que pasa si falla | Afecta la operacion clinica del sistema | Afecta la evidencia y certificacion del evento |

## 2. Componentes que participan

La capa off-chain del proyecto esta repartida en estos componentes:

| Componente | Archivo base | Funcion |
|---|---|---|
| API del backend | `backend/src/routes/episodes.ts` | Recibe solicitudes del frontend y orquesta validacion, persistencia, permisos y trazabilidad |
| Generacion documental | `backend/src/hce/documentoClinicoService.ts` | Construye el documento clinico canonico y calcula su hash |
| Cliente FHIR | `backend/src/hce/fhirClient.ts` | Hace operaciones HTTP contra HAPI FHIR |
| Persistencia FHIR | `backend/src/hce/fhirStorageService.ts` | Guarda, actualiza, busca y recupera episodios en FHIR |
| Estado local del backend | `backend/src/shared/jsonFileStore.ts` | Guarda en `backend/data/` el estado complementario de la aplicacion |
| Base clinica off-chain | `docker-compose.yml` | Levanta HAPI FHIR con PostgreSQL persistente |

## 3. Que informacion vive off-chain

Off-chain se guarda la informacion que el sistema necesita para operar clinicamente.

### 3.1 Documento clinico

El documento clinico completo se genera a partir del payload validado y conserva toda la estructura clinica del episodio:

- paciente,
- cobertura,
- encounter,
- prestador origen,
- prestador destino,
- diagnosticos,
- y otros campos del episodio.

En el codigo, ese documento se trata como `DocumentoClinicoOffChain`.

### 3.2 Recursos FHIR

Cuando `FHIR_BASE_URL` esta configurado, el backend persiste el episodio en HAPI FHIR usando recursos como:

- `Patient`
- `Encounter`
- `Organization`
- `Coverage`
- `Condition`
- `DocumentReference`

El `DocumentReference` se usa tambien para guardar un snapshot canonico serializado del episodio completo.

### 3.3 Estado funcional del backend

Ademas del documento clinico, la app necesita conservar estado operativo que no vive naturalmente en blockchain ni en el snapshot clinico.

Ese estado se guarda en archivos JSON dentro de `backend/data/` e incluye:

- lifecycle del episodio,
- permisos entre IPS,
- trazabilidad que consulta la app.

## 4. Donde se guarda cada cosa

| Tipo de informacion | Donde se guarda | Para que sirve |
|---|---|---|
| Documento clinico completo | HAPI FHIR | Consulta, continuidad asistencial, recuperacion del episodio |
| Snapshot canonico del episodio | `DocumentReference` en FHIR | Reconstruir el payload completo del episodio |
| Patient / Encounter / Coverage / Condition / Organization | HAPI FHIR | Interoperabilidad y consultas estructuradas |
| Lifecycle del episodio | `backend/data/episodio-lifecycle.json` | Versiones, evento clinico asociado, actor y fechas |
| Permisos entre IPS | `backend/data/episodio-permisos.json` | Control de acceso entre instituciones |
| Trazabilidad consultada por la app | `backend/data/episodio-trazabilidad.json` | Historial que se muestra en frontend |
| Hash del documento | Se calcula en backend y se reutiliza | Integridad y proyeccion on-chain |

## 5. Flujo de escritura off-chain

### 5.1 Cuando se crea un episodio

1. El frontend envia el formulario al backend.
2. El backend valida la estructura del episodio.
3. `documentoClinicoService.ts` genera el documento canonico.
4. Se calcula un hash SHA-256 del documento.
5. Se guarda el documento en HAPI FHIR.
6. Se actualiza el estado local del backend:
   - lifecycle,
   - permisos,
   - trazabilidad.
7. Se genera la proyeccion minima que luego se usa para blockchain.

## 5.2 Cuando se actualiza un episodio

1. El backend vuelve a generar el documento completo.
2. Recalcula el hash.
3. Actualiza en FHIR los recursos correspondientes.
4. Actualiza el snapshot en `DocumentReference`.
5. Registra nueva version en el lifecycle local.
6. Deja la evidencia blockchain asociada a esa nueva version.

## 6. Como se persiste en HAPI FHIR

La persistencia clinica principal ocurre en `fhirStorageService.ts`.

La logica actual hace esto:

- busca si ya existe un `Encounter` con el `episodeId`,
- si existe, actualiza los recursos principales,
- si no existe, crea `Patient`, `Organization` y `Encounter`,
- reemplaza condiciones asociadas al encuentro,
- actualiza o crea un `DocumentReference` con el snapshot completo.

Esto permite dos cosas al mismo tiempo:

- tener recursos FHIR indexables y consultables,
- y conservar una copia canonica completa del episodio para reconstruccion.

## 7. Como se recupera la informacion

### 7.1 Recuperacion por `episodeId`

Cuando la app consulta un episodio:

1. el backend intenta recuperarlo desde memoria local solo si existe en cache de ejecucion,
2. si FHIR esta configurado, lo consulta desde HAPI FHIR,
3. intenta reconstruir primero desde el snapshot `DocumentReference`,
4. si no hay snapshot util, recompone usando `Patient`, `Encounter`, `Organization` y `Condition`.

### 7.2 Busqueda por identificador del paciente

La busqueda off-chain sigue este camino:

1. busca `Patient` por identificador,
2. encuentra `Encounter` asociados,
3. extrae el `episodeId` desde `Encounter.identifier`,
4. para cada `episodeId`, reconstruye el resumen del episodio.

### 7.3 Listado de episodios

El listado general se apoya en `Encounter`, leyendo los `identifier` con sistema `urn:interhce:episode`.

## 8. Persistencia local del backend

Aunque FHIR guarda el contenido clinico, la aplicacion necesita tambien persistir estado complementario.

Para eso se usa `jsonFileStore.ts`, que escribe archivos JSON en `backend/data/`.

### Archivos actuales

- `backend/data/episodio-lifecycle.json`
- `backend/data/episodio-permisos.json`
- `backend/data/episodio-trazabilidad.json`

### Que resuelve esta capa local

Resuelve que al reiniciar el backend no se pierdan:

- las versiones del episodio que ve la app,
- la relacion de permisos entre IPS,
- la trazabilidad consultable por el frontend.

## 9. Persistencia de infraestructura

La capa off-chain no depende solo del codigo: tambien depende de la infraestructura.

En `docker-compose.yml` el proyecto levanta:

- `hapi-fhir`
- `hapi-fhir-db`

La base `hapi-fhir-db` usa un volumen Docker persistente:

- `hapi-fhir-postgres`

Eso permite que los recursos FHIR sobrevivan a reinicios normales de la maquina y del contenedor.

## 10. Que pasa si FHIR no esta configurado

Si `FHIR_BASE_URL` no esta definido:

- el backend sigue funcionando,
- pero el documento clinico queda solo en memoria,
- y se pierde al reiniciar.

Eso solo sirve como modo de prototipo o contingencia, no como persistencia real.

## 11. Relacion entre off-chain y blockchain

La capa off-chain prepara la informacion que la blockchain necesita, pero no le entrega el contenido clinico completo.

El proceso es:

1. se genera el documento clinico off-chain,
2. se calcula el hash canonico,
3. se derivan metadatos no sensibles,
4. se envia a blockchain solo la evidencia necesaria.

Por eso la blockchain no reemplaza a FHIR ni al backend.

## 12. Como se maneja la seguridad de la informacion

La seguridad off-chain se basa en separar responsabilidades:

- FHIR y el backend manejan el contenido clinico real.
- El backend aplica permisos por rol e IPS.
- La blockchain guarda evidencia, no datos clinicos sensibles.
- La app solo expone al usuario lo que su contexto de acceso permite consultar.

## 13. Riesgos y limitaciones actuales

La arquitectura actual funciona para el prototipo, pero tiene limites:

- parte del estado funcional depende de archivos locales del backend,
- si se elimina `backend/data/`, la app pierde lifecycle, permisos y trazabilidad local,
- si se destruye el volumen Docker de PostgreSQL, se pierde la persistencia de FHIR,
- la reconstruccion desde FHIR es mejor cuando existe el snapshot `DocumentReference`.

## 14. Resumen corto

La arquitectura off-chain de este proyecto funciona como el nucleo operativo del sistema:

- guarda el documento clinico real,
- lo organiza en recursos FHIR,
- conserva estado funcional para la app,
- permite busqueda, consulta y actualizacion,
- y entrega a blockchain solo hashes y metadatos no sensibles.

Si quieres resumirlo en una frase:

**off-chain es donde vive y se opera la informacion clinica; blockchain solo certifica lo importante.**
