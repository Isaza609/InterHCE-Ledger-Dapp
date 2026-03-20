Contexto del proyecto
- Proyecto Dapp hospitalaria en este repo: /home/aisaza/Documentos/Dapp
- Estructura principal:
  - frontend/: React + Vite (Dapp)
  - backend/: Express + TypeScript (API y servicios HCE/FHIR)
  - contracts/: Solidity (aún en scaffold)
  - shared/: artefactos compartidos
  - docs/, docs_plan/, docs_dev/: documentación funcional y técnica
- Estándares globales: seguir las guías definidas en AGENTS.md de la raíz del repo.

Situación actual
- El repositorio ya tiene implementadas las HU3-E0 y HU4-E0 (Sprint 1 / inicio Sprint 2), incluyendo validaciones iniciales y endpoints básicos de HCE/episodios.
- Hay documentación funcional y de validación en:
  - docs_dev/Sprint 1/ (ejemplos de documentación de validación por HU que debes seguir como referencia)
  - docs_dev/Sprint 2/ (por ejemplo HU4-E0-Validacion.md)
- El backend ya tiene endpoints de episodios y servicios de HCE bajo backend/src/routes y backend/src/hce, además de documentación OpenAPI en backend/src/docs/openapi.ts.
- El frontend ya tiene una estructura base (páginas, features, shared), pero el Sprint 2 requiere nuevas pantallas y flujos.

Objetivo de este encargo
Eres un agente de desarrollo full stack. Tu objetivo es DESARROLLAR COMPLETAMENTE el Sprint 2, asegurando que el backend, el frontend, los tests y la documentación de validación estén:
- Funcionales y conectados entre sí.
- Totalmente alineados con la documentación, requerimientos y HUs del proyecto.
- Integrados sin romper lo ya implementado en HU3-E0 y HU4-E0 y las HU del sprint 1

En concreto, el alcance incluye:
1) Terminar/ajustar validaciones relacionadas con HU3-E0 y HU4-E0 en Sprint 2 (según documentación de validación).
2) Desarrollar por completo las siguientes historias:
   - HU0-E1
   - HU1-E1
   - HU4-E1
   - HU1-E5
3) Crear la documentación de validación para cada HU de Sprint 2 siguiendo el mismo estilo, estructura y nivel de detalle que la documentación de validación existente en:
   - docs_dev/Sprint 1/
   - docs_dev/Sprint 2/HU4-E0-Validacion.md

Para cada HU, debes:
- Revisar la documentación funcional y de validación correspondiente en docs_dev/ y docs/.
- Asegurarte de que las reglas de negocio, campos obligatorios, flujos y restricciones se implementen tal como están documentadas.
- Mantener consistencia de nombres en español (por ejemplo: validarEpisodio, documentoClinicoService, etc.).
- Implementar backend, frontend, tests y documentación de validación específica para esa HU.

Requerimientos de backend
- Tecnología: Node.js + Express + TypeScript (ya configurado en backend/).
- Respetar la estructura actual:
  - Rutas en backend/src/routes/ (por ejemplo backend/src/routes/episodes.ts).
  - Servicios de HCE/FHIR en backend/src/hce/.
  - Tipos y modelos en backend/src/types/ (ya existe o debes integrarte a los que haya).
- Acciones backend:
  - Crear o extender endpoints necesarios para HU0-E1, HU1-E1, HU4-E1, HU1-E5.
  - Implementar lógicas de negocio y validaciones basadas en las HU y los documentos de validación (por ejemplo HU4-E0-Validacion.md y los equivalentes para cada HU).
  - Actualizar/crear esquemas de validación (por ejemplo con Zod o la librería usada actualmente en backend/src/hce/hceValidationSchema.ts).
  - Mantener y ampliar la documentación OpenAPI en backend/src/docs/openapi.ts para reflejar todas las rutas nuevas o modificadas.
  - Asegurar que el backend compile (npm run build) y que el servidor arranque correctamente (npm run dev / npm run start).
  - NO comprometer datos de pacientes reales ni introducir fixtures sensibles.

Requerimientos de tests de backend
- Crear tests automatizados para los endpoints y lógicas nuevas/modificadas del Sprint 2.
- Ubicación sugerida: backend/test/ (o siguiendo la convención ya presente en el repo).
- Para cada HU (HU0-E1, HU1-E1, HU4-E1, HU1-E5):
  - Crear, al menos:
    - Casos “felices” (flujos correctos).
    - Casos de validación (campos obligatorios faltantes, formatos inválidos, etc.).
- Los tests deben ser ejecutables con el comando que definas en backend/package.json (por ejemplo "npm test" o un script específico) y documentar claramente cómo correrlos.

Requerimientos de frontend
- Tecnología: React + Vite en frontend/.
- El diseño debe ser:
  - De estilo hospitalario moderno (colores, tipografía y disposición adecuados a un entorno clínico).
  - Intuitivo para personal sanitario.
  - No centrado en una sola tarjeta en el medio: debe ser un layout completo de aplicación (por ejemplo con barra lateral, encabezados, secciones claras, etc.).
- Acciones frontend:
  - Crear/ajustar pantallas y componentes necesarios para HU0-E1, HU1-E1, HU4-E1, HU1-E5.
  - Integrar correctamente con el backend usando la URL configurada en VITE_API_BASE_URL.
  - Respetar la organización de carpetas existente: src/app, src/pages, src/features, src/shared.
  - Manejar errores de validación y estados de carga de forma clara y usable (mensajes entendibles, feedback visual).
  - Mantener el estilo de código (TypeScript estricto, 2 espacios, punto y coma, doble comilla, componentes en PascalCase).

Criterios de diseño de UI
- Aplicación tipo sistema hospitalario:
  - Barra lateral de navegación o layout con áreas diferenciadas (no solo un formulario suelto en el centro).
  - Encabezados claros, breadcrumbs o indicaciones de contexto del episodio/paciente.
  - Uso de colores suaves y legibles (por ejemplo, tonos azules/verde hospital, fondos claros, buen contraste).
  - Formularios bien organizados: secciones, agrupación lógica de campos, uso de componentes reutilizables (inputs, selects, date pickers, etc.).
- Añadir micro-interacciones básicas (por ejemplo, estados hover, focus, botones deshabilitados mientras se envía, mensajes de éxito/error).

Requerimientos de documentación de validación por HU
- Para cada HU de Sprint 2 (HU0-E1, HU1-E1, HU4-E1, HU1-E5) crear un documento de validación en:
  - docs_dev/Sprint 2/
- El nombre de archivo debe seguir la convención ya usada, por ejemplo:
  - HU0-E1-Validacion.md
  - HU1-E1-Validacion.md
  - HU4-E1-Validacion.md
  - HU1-E5-Validacion.md
- La estructura, tono y nivel de detalle deben ser coherentes con:
  - Los documentos de validación de docs_dev/Sprint 1/
  - El archivo docs_dev/Sprint 2/HU4-E0-Validacion.md
- Cada documento de validación debe incluir, como mínimo:
  - Objetivo de la HU.
  - Alcance y supuestos.
  - Casos de prueba funcionales (incluyendo precondiciones, pasos, datos de prueba y resultados esperados).
  - Casos de validación (errores, campos obligatorios, límites de longitud, formatos, etc.).
  - Criterios de aceptación claramente marcados.
- Los casos documentados deben corresponderse con:
  - Los tests automatizados de backend creados.
  - Los flujos reales del frontend implementado.

Líneas generales de trabajo
1) Antes de implementar:
   - Leer AGENTS.md en la raíz para entender convenciones del repo.
   - Leer la documentación relevante a cada HU en docs/ y docs_dev/Sprint 2 (incluyendo HU4-E0-Validacion.md como referencia de estilo).
   - Revisar docs_dev/Sprint 1/ para entender cómo se estructura la documentación de validación y replicar ese formato para las nuevas HUs.
   - Revisar el código del backend actual en backend/src/routes y backend/src/hce para entender cómo se implementaron HU3-E0 y HU4-E0.
   - Revisar la estructura del frontend para alinear nuevas pantallas con lo ya existente.

2) Implementación backend para cada HU:
   - Definir/actualizar tipos y esquemas de validación.
   - Crear/actualizar endpoints y servicios necesarios.
   - Conectar con los servicios de HCE/FHIR existentes si aplica.
   - Actualizar la documentación OpenAPI.
   - Probar manualmente las rutas (por ejemplo con curl o HTTP client) para flujos principales y casos de validación.
   - Implementar tests automatizados correspondientes y documentar cómo ejecutarlos.

3) Implementación frontend para cada HU:
   - Crear páginas / vistas y componentes específicos.
   - Conectar con endpoints del backend.
   - Implementar flujo completo de usuario según la HU (incluyendo errores y confirmaciones).
   - Asegurar un diseño global coherente (menus, navegación, encabezados).

4) Documentación de validación:
   - Para cada HU, escribir el documento de validación en docs_dev/Sprint 2/ siguiendo el patrón de Sprint 1.
   - Asegurar trazabilidad entre:
     - Requerimientos de la HU.
     - Implementación en backend y frontend.
     - Tests automatizados.
     - Casos de prueba descritos en la documentación.

5) Calidad y alineación:
   - Ejecutar linters si están configurados, y corregir errores introducidos.
   - No romper funcionalidades previas (HU3-E0, HU4-E0).
   - Mantener nomenclatura en español y coherente con el dominio clínico.
   - No modificar configuración sensible (.env) más allá de lo estrictamente necesario y nunca comprometer secretos.

Formato de respuesta que espero de ti
- Explica paso a paso qué vas a hacer y en qué orden (plan de trabajo).
- Por cada HU (HU0-E1, HU1-E1, HU4-E1, HU1-E5):
  - Resume brevemente su objetivo funcional según la documentación.
  - Indica qué cambios harás en backend (archivos clave) y qué endpoints quedarán disponibles.
  - Indica qué cambios harás en frontend (páginas, componentes, rutas).
  - Indica qué tests automatizados crearás (qué cubren y dónde estarán ubicados).
  - Indica qué documento de validación crearás (nombre de archivo y secciones principales).
- Luego muestra los cambios de código relevantes (o referencias a archivos) de forma organizada.
- Asegúrate de que, al final, pueda:
  - Levantar el backend con `cd backend && npm run dev`.
  - Levantar el frontend con `cd frontend && npm run dev`.
  - Ejecutar los tests de backend con el comando que definas (y documentar ese comando).
  - Probar manualmente cada HU en la interfaz, con pasos claros (por ejemplo: “para HU1-E1, entra a la sección X, completa el formulario Y, pulsa Z…”).

Idioma
- Responde SIEMPRE en español.
- Usa terminología técnica clara, pero mantén las explicaciones concisas.