## HU2-E0. Validar la estructura de los episodios clínicos contra el modelo de HCE

### 1. Artefactos utilizados para la validación

- **Esquema de episodio**: `backend/src/hce/hceValidationSchema.ts` (`episodioFhirLikeSchema`).
- **Servicio de validación**: `backend/src/hce/validationService.ts` (`validateEpisodioClinico`).
- **Modelo de datos**: `backend/src/hce/hceModel.ts`.
- **Referencia funcional**: `docs_plan/3. Epicas e HU.md` (Épica 0, HU2-E0).

### 2. Verificación de criterios de aceptación

#### 2.1. Validación automática de la estructura antes del registro

- La función `validateEpisodioClinico`:
  - Recibe un `payload` arbitrario.
  - Aplica `episodioFhirLikeSchema.safeParse(payload)`.
  - Devuelve `valid: true` + `data` tipada solo si pasa todas las validaciones estructurales.

**Conclusión**: La estructura del episodio se valida automáticamente antes de continuar el flujo, cumpliendo este criterio.

#### 2.2. Verificación de campos obligatorios

- El esquema Zod marca como requeridos:
  - `patient`, `encounter`, `prestadorOrigen`, `diagnosticoIngreso`, etc.
  - Campos internos obligatorios (por ejemplo, `patient.identifier`, `encounter.period.start`, etc.).
- Si falta un campo obligatorio, `safeParse` falla y la función retorna `valid: false` con detalle de errores.

**Conclusión**: Los campos obligatorios se verifican estructuralmente, cumpliendo este criterio.

#### 2.3. Rechazo de episodios que no cumplan el modelo

- Cuando la validación falla, `validateEpisodioClinico` devuelve:
  - `valid: false`.
  - `issues` con `field` e `issue`, permitiendo identificar el motivo.
- El flujo de negocio puede usar este resultado para bloquear la creación/actualización del episodio.

**Conclusión**: Los episodios que no cumplen el modelo se rechazan a nivel estructural, cumpliendo este criterio.

#### 2.4. Separación entre validación estructural y clínica

- El esquema actual verifica:
  - Estructura, tipos, formatos y presencia de campos.
  - No incorpora reglas de pertinencia clínica (no juzga contenido médico).

**Conclusión**: La validación implementada es estrictamente estructural y de formato, no clínica, cumpliendo este criterio.

#### 2.5. Errores de validación claros para el usuario

- `validateEpisodioClinico` mapea las `issues` de Zod a objetos `{ field, issue }`:
  - `field`: ruta del campo (`patient.identifier[0].value`, etc.).
  - `issue`: mensaje de error generado por Zod.
- Esto permite a la DApp/backend presentar mensajes comprensibles al usuario.

**Conclusión**: Los errores de validación se pueden informar de forma clara, cumpliendo este criterio.

### 3. Resultado de la validación de la HU2-E0

- **Estado de la HU**: CUMPLIDA (diseño y desarrollo).  
- **Completitud a nivel desarrollo**: Implementado en backend (`validationService.ts`, `episodioFhirLikeSchema`) y usado en rutas `POST /episodes/validate`, `POST /episodes` y `PUT /episodes/:id`. La validación bloquea el flujo ante fallos (400 + detalles). El frontend consume la API (`api.ts`: `validarEpisodio`, `registrarEpisodio`) y muestra errores al usuario (`ErroresValidacion.tsx`, formulario en `CrearEpisodioPage`). Solo los episodios válidos pueden continuar en el flujo (hash/on-chain pendiente de HU posteriores).
- **Evidencia**: `episodioFhirLikeSchema` y `validateEpisodioClinico` implementan la validación estructural contra el modelo de HCE antes del registro on-chain.

---

## HU2-E0. Validación a nivel de diseño y especificación (documentación de alcance)

*La siguiente sección documenta el alcance de la HU a nivel de diseño; la implementación en código ya está cubierta en las secciones 1–3 anteriores.*

## HU2-E0. Validar la estructura de los episodios clínicos contra el modelo de HCE (alcance funcional)

### 1. Artefactos utilizados para la validación

- **Modelo de HCE y reglas de datos**: `docs_plan/Caracterizacion HCE.csv`
- **Definición de HU y alcance**: `docs_plan/3. Epicas e HU.md` (Épica 0, HU2-E0)
- **Requerimientos funcionales y no funcionales**: `docs_plan/2. Requerimientos funcionales y no funcionales.md`  
  - Especialmente **RF1**, **RF2**, **RF11** y **RNF7**.
- **Validaciones previas**:  
  - `docs_dev/Sprint 1/HU0-E0-Validacion.md` (estructura mínima de HCE).  
  - `docs_dev/Sprint 1/HU1-E0-Validacion.md` (formalización del modelo como esquema de referencia).

> Nota: Esta sección describe el alcance a nivel de **diseño y especificación**. La lógica de validación en backend/DApp **ya está implementada** (véase secciones 1–3 y `Validacion-desarrollo-HU0-HU1-HU2.md`).

### 2. Verificación de criterios de aceptación

#### 2.1. El sistema valida automáticamente la estructura del episodio clínico antes de su registro

- El modelo de HCE definido en `Caracterizacion HCE.csv` (y validado en HU0-E0 y HU1-E0) ya:
  - Establece los campos que conforman un episodio clínico de urgencias.
  - Define tipos de dato, formatos, obligatoriedad y catálogos normativos.
- En los requerimientos:
  - **RF1** indica que todo episodio clínico debe tener una representación estructurada off-chain en **HAPI FHIR**, basada en recursos HL7 FHIR apropiados.  
  - **RF11** establece que la estructura mínima de HCE será el **modelo obligatorio** para creación y actualización de episodios clínicos dentro de la DApp.
  - **RNF7** exige alineación con RDA y HL7 FHIR para asegurar interoperabilidad.
- De estas piezas se deriva que, para poder registrar (on-chain) un episodio clínico:
  - Previamente debe existir un documento/estructura off-chain conforme al modelo de HCE.  
  - La lógica de backend/DApp debe validar el payload clínico contra dicho modelo antes de permitir el registro.

**Estado del criterio**:  
- **Cumplido a nivel de diseño** (el deber ser está claramente definido).  
- **Pendiente de implementación** en código (módulo de validación estructural en backend/DApp, p.ej. validación contra perfiles FHIR y/o reglas derivadas del CSV).

#### 2.2. Los episodios que no cumplen el modelo de HCE son rechazados

- El alcance funcional de la HU2-E0 establece explícitamente:
  - «Rechazo de episodios que no cumplan el modelo definido».
- A nivel de diseño:
  - La separación entre:
    - **Estructura mínima obligatoria** (HU0-E0, HU1-E0, RF11).  
    - **Proceso de registro de episodios** (RF1 y RF2, donde se exigen episodios estructurados off-chain).  
  implica que un episodio solo puede llegar a registrarse si satisface la estructura definida.
- Lo que aún no está descrito en detalle en la documentación es:
  - El mecanismo exacto de rechazo (códigos de error, HTTP status, manejo de transacción fallida en el Smart Contract, etc.).

**Estado del criterio**:  
- **Conceptualmente cumplido** (la intención de rechazo de episodios no conformes está descrita en la HU y alineada con RF1/RF2/RF11).  
- **Requiere desarrollo**: implementar en backend/DApp la lógica que:
  - Valide el episodio contra el modelo de HCE.  
  - Bloquee el registro y devuelva un error cuando no cumpla.

#### 2.3. La validación no evalúa criterios médicos, solo estructura y formato

- El CSV de `Caracterizacion HCE.csv` define:
  - Tipos de dato, formatos, longitudes, catálogos y reglas técnicas (por ejemplo, «debe coincidir con catálogo», «solo números», «fecha válida; no futura», etc.).
  - No incluye reglas de pertinencia clínica (p. ej. si un diagnóstico es coherente con un procedimiento).
- Las HU de la Épica 0 y los RF/RNF:
  - Enfatizan la **interoperabilidad estructural** y la integridad de datos (hashes, trazabilidad, estructura mínima), no la toma de decisiones clínicas.
- De esto se concluye que:
  - La validación planificada se limita a comprobar **estructura, formato y pertenencia a catálogos**, sin emitir juicios clínicos.

**Estado del criterio**:  
- **Cumplido a nivel de definición**: el modelo de datos y los requerimientos delimitan la validación a estructura/formato.  
- La implementación deberá asegurarse de **no introducir reglas clínicas adicionales** que vayan más allá de esta especificación.

#### 2.4. Los errores de validación son informados de forma clara al usuario

- En la documentación existente:
  - Se menciona en **RNF8 (Usabilidad)** que la DApp debe ofrecer «validaciones de usuario claras» y «mensajes de error comprensibles».  
  - La HU2-E0 exige que «los errores de validación son informados de forma clara al usuario».
- Sin embargo, la documentación **no detalla aún**:
  - El formato concreto de los mensajes de error (estructura de respuesta, idioma, códigos).  
  - Cómo se mostrarán en la interfaz de la DApp ni ejemplos específicos.

**Estado del criterio**:  
- **Parcialmente cubierto a nivel de lineamientos**: RNF8 fija el principio de mensajes claros.  
- **Pendiente de diseño detallado e implementación**:
  - Definir convenciones de mensajes de error (por campo, por sección, códigos).  
  - Implementar la propagación de errores desde backend hacia la DApp y su presentación en UI.

#### 2.5. Solo los episodios válidos pueden continuar al proceso de generación de hash y registro on-chain

- En los requerimientos:
  - **RF1** y **RF2** plantean que el registro/actualización de episodios en el Smart Contract utiliza hashes del documento clínico off-chain.  
  - **RF8** indica que la verificación de integridad compara el hash on-chain con el documento off-chain.
- En las HU de la Épica 0:
  - HU2-E0 condiciona explícitamente que solo episodios válidos (estructuralmente) pasen a hash y registro.
  - HU3-E0 se apoya en que ya existe un documento estructurado, que será la base para el hash.
- A partir de esto, el flujo objetivo es:
  1. Construir/actualizar el documento clínico off-chain según el modelo de HCE.  
  2. Validar la estructura contra el modelo (CSV + perfiles FHIR).  
  3. **Solo si la validación es exitosa**, calcular hash y emitir transacción al Smart Contract.

**Estado del criterio**:  
- **Definido a nivel de flujo conceptual** (documentos de planificación).  
- **Pendiente de implementación**:
  - Enforced en la lógica de backend (no calcular hash ni llamar al contrato si falla la validación).  
  - Enforced en el Smart Contract (opcionalmente, asegurando que no se registren estructuras inválidas según las reglas mínimas on-chain).

### 3. Elementos que deben desarrollarse para completar la HU en implementación

A partir del análisis anterior, para considerar la HU2-E0 completamente cumplida en términos de **sistema implementado**, se deben desarrollar al menos:

- **Módulo de validación estructural en backend/DApp**:
  - Validación de payloads clínicos contra:
    - El modelo de datos de `Caracterizacion HCE.csv`.  
    - Los perfiles HL7 FHIR definidos según RF11/RNF7.
  - Verificación sistemática de campos obligatorios, tipos, formatos y catálogos.
- **Flujo de control de registro/actualización**:
  - Bloqueo del registro y actualización de episodios cuando la validación falle.  
  - Solo permitir el cálculo de hash y la llamada al Smart Contract si la validación es exitosa.
- **Gestión de errores de validación**:
  - Definición de un formato estándar de errores (lista de campos, código, mensaje amigable).  
  - Exposición de estos errores hacia la DApp para que sean mostrados de forma clara, siguiendo RNF8.

Estos puntos servirán como guía directa de desarrollo cuando se implemente el backend y la DApp.

### 4. Diseño concreto de implementación asociado a la HU2-E0

Para que la HU2-E0 quede cubierta **a nivel funcional y técnico**, se define el siguiente diseño de implementación (que deberá materializarse en la fase de construcción de la plataforma):

- **Backend / Servicio de validación**  
  - Endpoint sugerido: `POST /episodes/validate` y validaciones embebidas en `POST /episodes` y `PUT /episodes/{id}`.  
  - El backend construye una representación del episodio clínico (recurso o conjunto de recursos FHIR) y la valida contra:
    - Los perfiles HL7 FHIR definidos a partir de `Caracterizacion HCE.csv`.  
    - Reglas adicionales derivadas de las columnas `Tipo de dato`, `Formato / Longitud`, `Obligatorio`, `Valores permitidos / Catálogo` y `Validación técnica`.
  - Si la validación es correcta, el backend marca el episodio como **estructuralmente válido** y continúa el flujo hacia el cálculo de hash y el Smart Contract.

- **Formato estándar de errores de validación**  
  - Respuesta JSON propuesta para errores de validación:
    - `code`: identificador de error (por ejemplo, `VALIDATION_ERROR`).  
    - `message`: descripción general legible para el usuario.  
    - `details`: arreglo de objetos con:
      - `field`: nombre/camino del campo con error (por ejemplo, `patient.identifier[0].value`).  
      - `issue`: descripción técnica breve (por ejemplo, «campo obligatorio ausente», «no coincide con catálogo CIE-10», «formato de fecha inválido»).
  - La DApp mostrará estos mensajes siguiendo **RNF8**, destacando los campos a corregir.

- **Control de flujo hacia el Smart Contract**  
  - Solo si el episodio pasa la validación estructural:
    - Se genera el documento clínico off-chain definitivo.  
    - Se calcula el hash criptográfico (alineado con RF8).  
    - Se invoca la función correspondiente del Smart Contract para registrar o actualizar el episodio (RF1/RF2).
  - Si la validación falla:
    - No se calcula hash.  
    - No se envía transacción on-chain.  
    - Se devuelve al cliente la respuesta de error con el detalle de validación.

Este diseño concreta la forma en que se implementará la HU2-E0 dentro de la arquitectura planteada (Ethereum + HAPI FHIR + DApp), dejando listos los lineamientos para la fase de codificación.

### 5. Resultado de la validación de la HU2-E0

- **Estado de la HU en este proyecto de diseño**: **CUMPLIDA**, tanto en:
  - La definición del modelo de datos y reglas de validación estructural.  
  - El diseño técnico concreto de cómo se realizará la validación, el manejo de errores y el control de flujo hacia el Smart Contract.

En la fase de desarrollo de la plataforma, la implementación deberá seguir este diseño para mantener la trazabilidad entre la HU2-E0, el código y las pruebas de integración.

### 6. Representación FHIR-like en el backend

- La validación estructural descrita en esta HU se implementa actualmente en el backend sobre un **payload FHIR-like** (`FhirEpisodePayload`), que contiene:
  - `patient`: estructura compatible con `Patient` FHIR (identificadores, nombre, fecha de nacimiento, género).  
  - `encounter`: estructura compatible con `Encounter` FHIR (status, class, period, subject, serviceProvider, reasonCode).  
  - `diagnoses`: lista de estructuras compatibles con `Condition` FHIR (código CIE, sujeto, encounter y categorías).  
  - `organizations`: lista de estructuras compatibles con `Organization` FHIR (identificadores y nombre), opcional.
- Este payload se valida mediante el esquema `episodioFhirLikeSchema` (`backend/src/hce/hceValidationSchema.ts`), y es el que se recibe en los endpoints `/episodes` y `/episodes/validate` documentados en Swagger (`backend/src/docs/openapi.ts`), alineando así la HU2-E0 con la representación técnica actual.

