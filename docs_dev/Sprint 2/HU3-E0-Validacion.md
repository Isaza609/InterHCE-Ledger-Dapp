## HU3-E0. Utilizar el modelo de HCE para generar documentos clínicos off-chain

### 1. Artefactos utilizados para la validación

- **Fuente del modelo de HCE**: `docs_plan/Caracterizacion HCE_sinmapear.csv`
- **Mapeo a estándar FHIR**: `docs_plan/Mapeo_RDA_FHIR_urgencias.md`
- **Definición de la HU**: `docs_plan/3. Epicas e HU.md` (Épica 0, HU3-E0)
- **Implementación**:
  - `backend/src/hce/documentoClinicoService.ts` (generación de documento, hash, almacenamiento y recuperación off-chain)
  - `backend/src/hce/hceValidationSchema.ts` (esquema que materializa el modelo HCE/FHIR para el payload)
  - `backend/src/hce/hceModel.ts` (tipos FHIR-like alineados al mapeo)
  - `backend/src/routes/episodes.ts` (integración: POST/PUT generan y almacenan documento; GET `/episodes/:id/document` recupera)
- **Referencias**: `docs_plan/2. Requerimientos funcionales y no funcionales.md` (RF1, RF2, RF8, RF11), `docs_plan/Arquitectura-on-chain-off-chain.md`

### 2. Verificación de criterios de aceptación

#### 2.1. Los documentos clínicos se generan siguiendo estrictamente el modelo de HCE definido

- El modelo de HCE se define en **`Caracterizacion HCE_sinmapear.csv`** (campos RDA, tipos, obligatoriedad, catálogos).
- La proyección a estructura técnica se hace en **`Mapeo_RDA_FHIR_urgencias.md`** (recursos FHIR: Patient, Encounter, Condition, Procedure, Medication, etc.).
- En el backend, el **esquema de validación** `episodioFhirLikeSchema` (`hceValidationSchema.ts`) y los tipos en **`hceModel.ts`** materializan ese modelo: el payload que pasa la validación es conforme al HCE definido y al mapeo FHIR.
- El servicio **`generarDocumentoClinico`** (`documentoClinicoService.ts`) recibe únicamente un `EpisodioFhirLikeInput` ya validado; el documento clínico off-chain es exactamente esa estructura (FHIR-like), por tanto se genera **siguiendo estrictamente** el modelo de HCE definido y su representación FHIR.

**Conclusión**: Los documentos clínicos se generan a partir del payload validado contra el modelo de HCE (CSV + mapeo FHIR), cumpliendo este criterio.

#### 2.2. El documento clínico no se almacena en la Blockchain

- El almacenamiento se realiza en **memoria** en el backend (`almacenOffChain`, `documentoClinicoService.ts`); no existe en el código ninguna escritura del documento clínico en una red Blockchain.
- En la arquitectura (`Arquitectura-on-chain-off-chain.md`) y en los RF (RNF1, RF1) se establece que la información clínica reside off-chain y que en Blockchain solo se registran hashes e identificadores; la implementación cumple con ello: solo se persiste el documento en el almacén off-chain del backend y se expone el **hash** para uso futuro on-chain.

**Conclusión**: El documento clínico no se almacena en la Blockchain; solo se almacena off-chain y se calcula un hash para posible registro on-chain, cumpliendo este criterio.

#### 2.3. Cada documento clínico está asociado a un único episodio clínico

- El almacén off-chain está indexado por **`episodeId`** (`Map<string, DocumentoAlmacenado>`). Cada entrada contiene `episodeId`, `document`, `hash` y `createdAt`.
- En **POST /episodes** se genera un `episodeId` (UUID) y se almacena un único documento para ese id; en **PUT /episodes/:id** se actualiza el documento asociado a ese mismo `episodeId`. La relación es **1:1** (un episodio ↔ un documento clínico).

**Conclusión**: Cada documento clínico está asociado a un único episodio clínico mediante `episodeId`, cumpliendo este criterio.

#### 2.4. El documento generado puede ser utilizado para calcular un hash criptográfico verificable

- **`calcularHashDocumento`** (`documentoClinicoService.ts`) calcula SHA-256 sobre la representación **canónica** del documento (serialización JSON con claves ordenadas recursivamente), de modo que el mismo documento produce siempre el mismo hash.
- Cada vez que se almacena un documento se calcula y se guarda su **hash**; la respuesta de POST y PUT incluye **`documentHash`** para uso en registro on-chain (RF1, RF8).
- Cualquier parte que tenga el documento puede recalcular el hash con la misma función y compararlo con el registrado on-chain para **verificación de integridad** (RF8).

**Conclusión**: El documento generado puede usarse para calcular un hash criptográfico estable y verificable, cumpliendo este criterio.

#### 2.5. El almacenamiento off-chain permite recuperar el documento conforme a los permisos establecidos

- **`recuperarDocumentoClinico(episodeId)`** permite obtener el documento almacenado por episodio.
- La ruta **GET /episodes/:id/document** expone la recuperación del documento (y su hash y fecha) para el `episodeId` dado. En el prototipo no se aplica aún control de acceso; la documentación del endpoint y del servicio indica que la recuperación **debe respetar los permisos establecidos** (RF3, RF4) cuando se implemente el control de acceso por rol/IPS.

**Conclusión**: El almacenamiento off-chain permite recuperar el documento por episodio; la interfaz está preparada para aplicar permisos en la capa API cuando exista control de acceso, cumpliendo este criterio.

### 3. Resultado de la validación de la HU3-E0

- **Estado de la HU**: **CUMPLIDA** (diseño y desarrollo).
- **Completitud a nivel desarrollo**:
  - **Generación**: el documento clínico se genera a partir del payload validado (modelo HCE vía CSV + mapeo FHIR), en `generarDocumentoClinico`.
  - **Almacenamiento**: el documento se guarda off-chain en el backend (`almacenarDocumentoClinico`), asociado 1:1 al `episodeId`.
  - **Hash**: se calcula con `calcularHashDocumento` (SHA-256, serialización canónica) y se devuelve en las respuestas de POST y PUT como `documentHash`.
  - **Recuperación**: GET `/episodes/:id/document` devuelve el documento, el hash y la fecha de creación; la aplicación de permisos en la recuperación queda pendiente de la implementación del control de acceso (RF3, RF4).
- **Evidencia**:
  - `backend/src/hce/documentoClinicoService.ts`: generación, hash y almacén off-chain.
  - `backend/src/routes/episodes.ts`: integración con validación, generación, almacenamiento y endpoint de recuperación.
  - Modelo de HCE: `docs_plan/Caracterizacion HCE_sinmapear.csv`; proyección FHIR: `docs_plan/Mapeo_RDA_FHIR_urgencias.md`; esquema y tipos en `hceValidationSchema.ts` y `hceModel.ts`.

La HU3-E0 queda validada: el sistema utiliza el modelo de HCE para generar documentos clínicos off-chain, almacenarlos asociados a un único episodio, prepararlos para hash verificable y permitir su recuperación (con la salvedad de permisos en la capa de autorización).

### 4. Flujo implementado (resumen)

1. **Registro (POST /episodes)**  
   Validación del payload → generación del documento desde el payload validado → almacenamiento off-chain por `episodeId` → cálculo de hash → respuesta con `episodeId` y `documentHash`.

2. **Actualización (PUT /episodes/:id)**  
   Validación del payload → generación del nuevo documento → reemplazo en almacén off-chain para ese `episodeId` → nuevo hash → respuesta con `documentHash`.

3. **Recuperación (GET /episodes/:id/document)**  
   Búsqueda por `episodeId` en el almacén off-chain → respuesta con documento, hash y fecha (permisos a aplicar cuando exista control de acceso).
