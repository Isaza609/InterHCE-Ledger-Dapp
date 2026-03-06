## HU1-E0. Formalizar el modelo de HCE como esquema de referencia del sistema

### 1. Artefactos utilizados para la validación

- **Modelo lógico de datos**: `docs_plan/Caracterizacion HCE.csv`.
- **Mapeo normativo a FHIR**: `docs_dev/docs_monografia/Mapeo_RDA_FHIR_urgencias.md` (referencia canónica del mapeo RDA → FHIR).
- **Modelo técnico backend**: `backend/src/hce/hceModel.ts` (`EpisodioClinicoUrgencias` / `FhirEpisodePayload`).
- **Esquema de validación**: `backend/src/hce/hceValidationSchema.ts` (`episodioFhirLikeSchema`).

### 2. Verificación de criterios de aceptación

#### 2.1. Esquema formal claramente definido

- El modelo de HCE está representado:
  - Como **estructura tabular normativa** en `Caracterizacion HCE.csv`.
  - Como **mapa RDA → FHIR** en `Mapeo_RDA_FHIR_urgencias.md`, indicando recurso, elemento y cardinalidad.
  - Como **interfaces TypeScript** en `hceModel.ts` que formalizan el agregado `EpisodioClinicoUrgencias`.

**Conclusión**: El modelo de HCE está representado mediante un esquema formal y unívoco, cumpliendo este criterio.

#### 2.2. Definición de campos obligatorios y opcionales

- En `Caracterizacion HCE.csv` se explicita, por campo, si es obligatorio (`Obligatorio`) u opcional.
- En `Mapeo_RDA_FHIR_urgencias.md` se indica la **cardinalidad FHIR** estimada (por ejemplo, `1..1`, `0..1`, `0..*`).
- En `hceValidationSchema.ts`:
  - Los campos obligatorios se modelan como requeridos en Zod.
  - Los campos opcionales se marcan como `.optional()` o se colocan en estructuras opcionales.

**Conclusión**: El esquema distingue de forma clara campos obligatorios y opcionales, cumpliendo este criterio.

#### 2.3. Tipos de datos y reglas básicas de validación

- Los tipos y formatos se definen:
  - En el CSV (`Tipo de dato`, `Formato / Longitud`).
  - En el mapeo FHIR (tipo FHIR correspondiente).
  - En los esquemas Zod (`string().datetime()`, `regex` para fechas y códigos, enums para valores cerrados, etc.).

**Conclusión**: El modelo cuenta con tipos de datos y validaciones estructurales básicas, cumpliendo este criterio.

#### 2.4. Versionado del esquema de HCE

- El modelo se concentra en artefactos versionables:
  - Documentos en `docs_plan` (CSV y mapeo FHIR).
  - Código en `backend/src/hce`.
- La HU contempla que ajustes futuros se manejen como nuevas versiones de estos artefactos sin alterar episodios ya registrados on-chain.

**Conclusión**: El diseño permite versionar el esquema de HCE mediante actualización controlada de estos artefactos, cumpliendo este criterio.

#### 2.5. Disponibilidad del esquema para backend y DApp

- El modelo está disponible:
  - En documentación funcional (`docs_plan`).
  - En código de backend (`hceModel.ts`, `hceValidationSchema.ts`).
- Estos artefactos son consumibles tanto por servicios backend como por el diseño de la DApp (formularios y DTOs).

**Conclusión**: El esquema es accesible para los componentes del sistema que lo requieren, cumpliendo este criterio.

### 3. Resultado de la validación de la HU1-E0

- **Estado de la HU**: CUMPLIDA (diseño y desarrollo).  
- **Completitud a nivel desarrollo**: El esquema está implementado en backend (`hceModel.ts`, `hceValidationSchema.ts`) y el frontend consume tipos alineados (`frontend/src/shared/types/episodio.ts`) para formularios y API. El esquema es accesible y utilizado por ambos componentes.
- **Evidencia**: la combinación de `Caracterizacion HCE.csv`, `Mapeo_RDA_FHIR_urgencias.md` (en `docs_dev/docs_monografia/`), `hceModel.ts` y `hceValidationSchema.ts` formaliza el modelo de HCE como esquema de referencia técnico-funcional.

### 4. Representación del esquema de referencia en HL7 FHIR y backend

- El modelo de HCE definido en `docs_plan/Caracterizacion HCE.csv` se proyecta a un conjunto de recursos **HL7 FHIR**, descritos en `docs/HCE-RDA-a-FHIR.md`, que actúan como esquema de referencia interoperable (perfiles sobre `Patient`, `Encounter`, `Condition`, `Procedure`, `Medication*`, `Organization`, `Coverage`, `DocumentReference`, etc.).
- En el backend, este esquema de referencia se materializa inicialmente como un DTO FHIR-like (`FhirEpisodePayload` en `backend/src/hce/hceModel.ts`), que agrupa los elementos esenciales del episodio de urgencias (`patient`, `encounter`, `diagnoses`, `organizations`) y es el objeto sobre el cual se aplica la validación estructural (`episodioFhirLikeSchema` en `backend/src/hce/hceValidationSchema.ts` y `validateEpisodioClinico` en `backend/src/hce/validationService.ts`).
## HU1-E0. Formalizar el modelo de HCE como esquema de referencia del sistema

### 1. Artefactos utilizados para la validación

- **Modelo de datos normativo**: `docs_plan/Caracterizacion HCE.csv`
- **Definición de HU y alcance**: `docs_plan/3. Epicas e HU.md` (Épica 0, HU1-E0)
- **Requerimientos funcionales y no funcionales**: `docs_plan/2. Requerimientos funcionales y no funcionales.md`  
  - En especial **RF11** (definición y uso de la estructura mínima de HCE) y **RNF7** (interoperabilidad).
- **Referencias normativas**: `docs_plan/4. Referencias Normativas.md`

### 2. Verificación de criterios de aceptación

#### 2.1. El modelo de HCE está representado mediante un esquema formal claramente definido

- El archivo `Caracterizacion HCE.csv` estructura el modelo de HCE en filas y columnas con la siguiente forma:
  - `Nombre del dato RDA`
  - `Tipo de dato`
  - `Formato / Longitud`
  - `Obligatorio`
  - `Valores permitidos / Catálogo`
  - `Validación técnica`
  - `Uso en Smart Contract`
  - `Estructura en red Blockchain`
  - `Fuente normativa`
- Cada agrupación temática (identificación de prestador, identificación del paciente, datos sociodemográficos, urgencia, diagnósticos de ingreso y egreso, procedimientos, medicamentos, incapacidad, profesional tratante, documento soporte, etc.) define explícitamente los elementos que componen el modelo de HCE para urgencias.
- El requerimiento **RF11** indica que esta estructura mínima de HCE debe implementarse como perfiles y recursos HL7 FHIR en HAPI FHIR, reforzando que el modelo no es solo conceptual sino que se proyecta a un **esquema formal interoperable**.

**Conclusión**: El modelo de HCE cuenta con un **esquema formal, tabular y normativamente referenciado**, adecuado para ser llevado a perfiles FHIR, cumpliendo este criterio.

#### 2.2. El esquema define campos obligatorios y opcionales

- La columna `Obligatorio` del CSV clasifica cada dato como:
  - **Sí**: campos obligatorios (por ejemplo, identificación del prestador, tipo y número de documento, triage, diagnósticos principales, fechas clave de atención, etc.).
  - **No** u **Opcional/condicional**: campos opcionales o condicionados (por ejemplo, segundo nombre, comunidad étnica, diagnósticos CIE-11, días de licencia de maternidad).
- Esta diferenciación está alineada con:
  - La normativa del **RDA de urgencias** y la **Resolución 866 de 2021** (referenciada en `Fuente normativa`).
  - Los lineamientos de interoperabilidad y estructura mínima descritos en **RNF7**.

**Conclusión**: El esquema identifica explícitamente **qué campos son obligatorios y cuáles son opcionales/condicionales**, cumpliendo este criterio.

#### 2.3. El esquema permite validar la estructura de los datos clínicos antes de su registro

- La combinación de columnas `Tipo de dato`, `Formato / Longitud`, `Valores permitidos / Catálogo` y `Validación técnica` proporciona reglas suficientes para:
  - Verificar tipos primitivos (String, Código, Número, datetime).
  - Validar formatos (longitudes máximas/mínimas, patrones de fecha/hora).
  - Comprobar pertenencia a catálogos oficiales (CIE-10/CIE-11, CUPS, catálogos de Minsalud, DANE, ISO 3166-1, etc.).
  - Aplicar reglas condicionales (por ejemplo, campos requeridos solo si otro campo tiene cierto valor).
- En los requerimientos:
  - **RF11** indica que la estructura mínima de HCE será utilizada como modelo obligatorio para creación y actualización de episodios clínicos, lo que implica que la DApp y el backend deberán validar la estructura contra este esquema antes de registrar o actualizar un episodio.
  - La Épica 0 y la HU2-E0 refuerzan la existencia de una **validación estructural** basada en el modelo.

**Conclusión**: El esquema definido en el CSV provee **reglas suficientes para validación estructural** previa al registro de datos clínicos, cumpliendo este criterio.

#### 2.4. El modelo puede evolucionar mediante versionamiento sin afectar episodios previamente creados

- El modelo de HCE se materializa actualmente como:
  - Un artefacto de planeación (`Caracterizacion HCE.csv`) versionable en el repositorio del proyecto.
  - Una proyección a perfiles y recursos HL7 FHIR (según **RF11** y **RNF7**), que también son versionables mediante:
    - Identificadores de versión de perfiles FHIR.
    - Nuevas releases del servidor HAPI FHIR con conjuntos de perfiles actualizados.
- La arquitectura descrita en los requerimientos funcionales y no funcionales separa:
  - La **trazabilidad on-chain** (hashes e identificadores de episodios en Ethereum).
  - La **representación off-chain** de los documentos clínicos y recursos FHIR.
- Esto permite que:
  - Nuevas versiones del modelo de HCE se apliquen a episodios futuros (nuevas estructuras, campos adicionales, reglas actualizadas).
  - Los episodios ya registrados mantengan su integridad e interpretación basada en la versión del modelo vigente al momento de su creación (conservando sus hashes y recursos FHIR históricos).

**Conclusión**: La forma en que se concibe el modelo (artefacto de datos + perfiles FHIR + separación on-chain/off-chain) **permite el versionamiento sin comprometer la validez de episodios ya registrados**, cumpliendo este criterio.

#### 2.5. El esquema es accesible para los componentes del sistema que lo requieran

- A nivel de planificación y documentación:
  - El esquema está centralizado en `Caracterizacion HCE.csv`, accesible para todo el equipo (backend, frontend, diseño de smart contracts).
  - La documentación de requerimientos (**RF11**, **RNF7**) especifica que el modelo se implementará en un servidor **HAPI FHIR**, que expone los recursos y perfiles a través de servicios REST FHIR.
- A nivel de arquitectura objetivo:
  - La **DApp** consumirá el esquema de datos a través de:
    - Los endpoints FHIR (para validar y construir documentos clínicos off-chain).
    - La lógica del Smart Contract (que aplica las reglas mínimas on-chain indicadas en `Uso en Smart Contract` y `Estructura en red Blockchain`).
  - Otros componentes (por ejemplo, servicios de interoperabilidad de IPS) podrán acceder al esquema mediante:
    - La documentación técnica del proyecto.
    - La inspección de perfiles FHIR publicados en el servidor HAPI FHIR.

**Conclusión**: El esquema no está encapsulado en un solo componente, sino que se define como **referencia compartida** entre backend, DApp y servicios de interoperabilidad, garantizando su accesibilidad y cumpliendo este criterio.

### 3. Resultado de la validación de la HU1-E0

- **Estado de la HU**: CUMPLIDA (a nivel de diseño y documentación del modelo).  
- **Evidencias principales**:
  - `docs_plan/Caracterizacion HCE.csv` como esquema formal detallado del modelo de HCE para urgencias.
  - `docs_plan/2. Requerimientos funcionales y no funcionales.md` (**RF11**, **RNF7**) que establecen el uso obligatorio del modelo como referencia y su implementación interoperable en HAPI FHIR.
  - `docs_plan/4. Referencias Normativas.md` que respalda normativamente la estructura y su implementación.

La HU1-E0 queda, por tanto, validada en el contexto de planificación del sistema, sirviendo como base para las siguientes HU de la Épica 0 (validación estructural de episodios y generación de documentos off-chain).

### 3. Diseño técnico asociado a la HU1-E0

Aunque el modelo de HCE completo sigue referenciado de forma canónica en `docs_plan/Caracterizacion HCE.csv`, para el desarrollo inicial del backend se ha definido un **primer subconjunto implementado** del esquema:

- **Modelo TypeScript del episodio de urgencias**  
  - Archivo: `backend/src/hce/hceModel.ts`.  
  - Contenido:
    - `EpisodioClinicoUrgencias` agrupa:
      - `PrestadorSaludIdentificacion`
      - `PacienteIdentificacion`
      - `DatosSociodemograficos`
      - `DatosUrgenciaAtencionInmediata`
      - `DiagnosticoPrincipalIngreso`
      - `DiagnosticoPrincipalEgreso`
  - Este subconjunto corresponde a los campos esenciales de:
    - Identificación del prestador y del paciente.  
    - Datos clave de la urgencia (inicio/fin, triage, entorno, causa).  
    - Diagnóstico principal de ingreso y de egreso.

- **Esquema formal de validación**  
  - Archivo: `backend/src/hce/hceValidationSchema.ts`.  
  - Implementado con **Zod** (`episodioClinicoUrgenciasSchema`), define:
    - Tipos de dato (string, datetime, enums).  
    - Reglas de formato (longitudes mínimas/máximas, regex para documento, ISO datetime).  
    - Campos obligatorios y opcionales (segundo apellido, segundo nombre, etc.).
  - Este esquema es la **proyección técnica** del modelo de HCE, utilizada por el backend para validar episodios.

- **Servicio de validación reutilizable**  
  - Archivo: `backend/src/hce/validationService.ts`.  
  - Expone la función `validateEpisodioClinico(payload)` que:
    - Aplica `episodioClinicoUrgenciasSchema.safeParse`.  
    - Devuelve una estructura estándar con:
      - `valid: boolean`.  
      - `issues: { field, issue }[]` en caso de error.  
      - `data` tipada (`EpisodioClinicoUrgenciasInput`) cuando la validación es exitosa.

Este diseño técnico concretiza la HU1-E0 para el ámbito del backend, utilizando el CSV como fuente normativa y materializando un esquema formal ejecutable sobre un subconjunto priorizado del modelo de HCE.
