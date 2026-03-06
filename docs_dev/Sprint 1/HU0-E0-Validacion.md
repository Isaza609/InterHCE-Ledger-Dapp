## HU0-E0. Definir la estructura mínima de Historia Clínica Electrónica para urgencias

### 1. Artefactos utilizados para la validación

- **Fuente principal**: `docs_plan/Caracterizacion HCE.csv`
- **Referencia de requerimientos**: `docs_plan/3. Epicas e HU.md` (sección Épica 0, HU0-E0)

### 2. Verificación de criterios de aceptación

#### 2.1. Inclusión de campos esenciales de identificación, atención y evolución clínica

- **Identificación del prestador y del paciente**:  
  - Filas como `16. Código del prestador de servicios de salud`, `2.1 Tipo de documento`, `2.2 Número de documento`, `3.x Nombres y apellidos`, `1.x País`, `11.x/12.x Residencia`, `14 Zona territorial` cubren los datos de identificación del prestador y del paciente.
- **Datos de atención en urgencias**:  
  - Secciones `Datos de la Urgencia / Atención Inmediata`, `Triage`, `Diagnóstico Principal de Ingreso`, `Diagnósticos de Egreso`, `Remisión` y `Datos de Incapacidad` cubren inicio/fin de atención, entorno, causa, triage, diagnósticos, destino/condición de egreso e incapacidad.
- **Evolución clínica y tecnologías en salud**:  
  - Secciones `Antecedentes de Salud`, `Factores de Riesgo`, `Procedimientos Realizados`, `Medicamentos Administrados`, `Otras Tecnologías Administradas`, `Medicamentos Ordenados al Egreso`, `Procedimientos Ordenados al Egreso` y `Otras Tecnologías Ordenadas al Egreso` describen procedimientos, medicamentos, resultados y otros eventos a lo largo del episodio.

**Conclusión**: El CSV incluye de forma explícita los campos esenciales de **identificación**, **atención** y **evolución clínica** para el escenario de urgencias, cumpliendo este criterio.

#### 2.2. Alineación con la normativa colombiana aplicable al RDA

- La columna `Fuente normativa` referencia de manera sistemática **“RDA Urgencias”**, **Resolución 866 de 2021**, **Catálogos Minsalud**, **DANE**, **ISO 3166-1**, **CIE-10/CIE-11**, **REPS**, **ADRES**, entre otros.
- Cada dato está ligado a un **código o catálogo oficial** (por ejemplo, CIE-10, CUPS, catálogos de vías de administración, causas de atención, tipos de identificación, etc.), lo que refleja la alineación con los estándares regulatorios.

**Conclusión**: La estructura propuesta en `Caracterizacion HCE.csv` está explícitamente alineada con el **RDA de urgencias** y la normativa colombiana asociada, cumpliendo este criterio.

#### 2.3. Modelo documentado de forma clara y comprensible

- El CSV organiza cada elemento de datos en columnas claras:  
  - `Nombre del dato RDA`, `Tipo de dato`, `Formato / Longitud`, `Obligatorio`, `Valores permitidos / Catálogo`, `Validación técnica`, `Uso en Smart Contract`, `Estructura en red Blockchain`, `Fuente normativa`.
- Esta estructura permite entender, para cada campo:
  - Su **significado funcional** (nombre del dato y agrupación temática).
  - Sus **restricciones técnicas** (tipo, formato, obligatoriedad, validación).
  - Su **uso en la DApp/Smart Contract** y si va **on-chain** u **off-chain**.

**Conclusión**: El modelo de HCE está documentado como un artefacto formal, legible y comprensible para negocio y para el equipo técnico, cumpliendo este criterio.

#### 2.4. Independencia de la implementación técnica de cada IPS

- Los campos están definidos en términos de:
  - **Datos normativos estándar** (códigos CIE, CUPS, catálogos oficiales, ISO, DANE).
  - **Estructura lógica de la atención** (identificación, datos sociodemográficos, urgencia, diagnósticos, procedimientos, medicamentos, egreso, incapacidad, profesional tratante).
- No se hace referencia a estructuras específicas de bases de datos, nombres de tablas, pantallas o flujos internos de ninguna IPS.
- La columna `Uso en Smart Contract` y `Estructura en red Blockchain` describe el uso en la DApp/infraestructura propuesta, no en sistemas legados de IPS.

**Conclusión**: El modelo de datos está definido a un nivel **lógico y normativo**, independiente de cualquier implementación particular de una IPS, cumpliendo este criterio.

#### 2.5. Utilización como referencia común para múltiples IPS

- El uso consistente de **catálogos nacionales y estándares internacionales** (REPS, ADRES, CIE-10/CIE-11, CUPS, ISO, DANE, catálogos Minsalud) garantiza que cualquier IPS que cumpla la normativa puede mapear sus datos internos a esta estructura.
- La separación entre:
  - **Metadatos on-chain** (identificadores, códigos, marcas temporales).
  - **Referencias off-chain** (documentos, descripciones textuales detalladas).  
  facilita que diferentes IPS integren sus repositorios clínicos manteniendo interoperabilidad.

**Conclusión**: La caracterización propuesta constituye un **modelo de referencia común** para la HCE de urgencias, reutilizable por múltiples IPS, cumpliendo este criterio.

### 3. Resultado de la validación de la HU0-E0

- **Estado de la HU**: CUMPLIDA (diseño y desarrollo).  
- **Completitud a nivel desarrollo**: Esta HU tiene como entregable un **artefacto de diseño** (estructura documentada en CSV). No requiere código de aplicación; el CSV existe, está versionado y es la base para HU1-E0 y HU2-E0. Considerada **completa a nivel de desarrollo** en ese alcance.
- **Evidencia**: `docs_plan/Caracterizacion HCE.csv` recoge una estructura mínima de HCE para urgencias:
  - Basada en RDA de urgencias y normativa asociada.
  - Con campos esenciales de identificación, atención y evolución clínica.
  - Documentada de forma clara y estructurada.
  - Definida de forma independiente de sistemas específicos de IPS.
  - Diseñada para servir como esquema de referencia común e interoperable.
