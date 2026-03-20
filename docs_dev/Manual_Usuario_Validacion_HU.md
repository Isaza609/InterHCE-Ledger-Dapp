# Manual puntual de validacion en interfaz (Frontend)

Este manual esta enfocado en validar desde la UI lo implementado en frontend, HU por HU.

## 1. Preparacion del entorno

1) Levantar backend:

```bash
cd backend
npm run dev
```

2) Levantar frontend:

```bash
cd frontend
npm run dev
```

3) Abrir la aplicacion en:
- `http://localhost:5173`

## 2. Flujo base obligatorio

Antes de validar cualquier HU:

1. Entrar a `Iniciar sesion` (`/login`).
2. Seleccionar rol y, si aplica, IPS.
3. Confirmar en la cabecera que aparece la pildora de sesion (`rol · ips`).

Si no hay sesion, muchas acciones del portal quedaran bloqueadas por diseno.

## 3. Datos de prueba recomendados (UI)

Usar estos datos en `Crear episodio` y `Actualizar episodio`:

- Identificador paciente: `12345678`
- Apellido: `Perez`
- Nombre: `Ana`
- Fecha nacimiento: `1990-05-20`
- Inicio atencion: fecha actual + hora `08:00`
- Clase: `EMER`
- Codigo REPS IPS origen: `IPS-001`
- Diagnostico CIE-10: `A09`

Importante: guardar el `ID del episodio` que devuelve la UI al registrar.

## 4. Validacion puntual por HU en interfaz

## Sprint 2

### HU0-E1 - Crear episodio clinico de urgencias
- Ruta UI: `/episodios/crear`
- Rol para prueba positiva: `profesional_salud` o `admin_ips`
- Pasos:
  1. Iniciar sesion con rol autorizado y `IPS-001`.
  2. Ir a `Episodios > Crear episodio`.
  3. Completar formulario con los datos de prueba.
  4. Pulsar `Registrar episodio`.
- Resultado esperado:
  - Mensaje de exito.
  - Visualizacion de `ID del episodio`.
  - Visualizacion de `Hash documento`.

### HU1-E1 - Actualizar episodio durante atencion
- Ruta UI: `/episodios/actualizar`
- Pasos:
  1. Tener un episodio ya creado (HU0-E1).
  2. Pegar el `ID del episodio` en campo `ID del episodio a actualizar`.
  3. Modificar al menos un dato clinico (ej. diagnostico CIE-10).
  4. Pulsar `Actualizar episodio`.
- Resultado esperado:
  - Mensaje de actualizacion exitosa.
  - Nuevo hash/documento en respuesta.
  - El episodio conserva historial (no se pierde version anterior).

### HU4-E1 - Asociar episodio a evento de urgencias y mantener trazabilidad
- Ruta UI: `/episodios/trazabilidad`
- Pasos:
  1. Ingresar `ID del episodio`.
  2. Pulsar `Consultar trazabilidad`.
  3. Revisar bloque `Evento de urgencias asociado`.
  4. Revisar tabla `Historial de versiones`.
- Resultado esperado:
  - Se muestra `ID evento`, `Inicio`, `IPS origen`, `Tipo de atencion`.
  - Se muestran versiones con `rol`, `IPS` y `hash`.

### HU1-E5 - Infraestructura de entorno de prueba
- Ruta UI: `/infraestructura`
- Pasos:
  1. Pulsar `Configurar IPS simuladas`.
  2. Pulsar `Activar contratos simulados`.
  3. Pulsar `Refrescar estado`.
- Resultado esperado:
  - `Total IPS` >= 2.
  - `Contratos operativos: Si`.
  - Estado final: entorno listo para flujos de sprint.

## Sprint 3

### HU0-E3 - Definir y gestionar roles
- Ruta UI: `/portal`
- Pasos:
  1. Iniciar sesion con cualquier rol.
  2. Entrar a `Portal clinico`.
  3. Revisar tarjetas `Contexto de acceso` y `Roles del sistema`.
- Resultado esperado:
  - Se listan roles del sistema.
  - Se listan capacidades por rol.

### HU1-E3 - Restringir acciones segun rol
- Ruta UI: `/portal`
- Pasos:
  1. Probar sesion como `paciente` o `auditor`.
  2. Ir a modulos de gestion (usuarios/permisos/documentos).
  3. Intentar ejecutar acciones.
- Resultado esperado:
  - Botones deshabilitados para acciones no autorizadas.
  - Mensajes de restriccion visibles en pantalla.

### HU2-E3 - Gestion de usuarios dentro de IPS
- Ruta UI: `/portal`
- Rol para prueba positiva: `admin_ips`
- Pasos:
  1. Iniciar sesion como `admin_ips` con `IPS-001`.
  2. En `Gestion de usuarios IPS`, crear usuario.
  3. Activar/desactivar usuario desde la tabla.
- Resultado esperado:
  - Usuario aparece en listado.
  - Estado activo/inactivo cambia inmediatamente.

### HU4-E5 - Integracion con documentos off-chain y permisos
- Ruta UI: `/portal`
- Pasos:
  1. Ingresar `ID episodio` en bloque de documentos.
  2. Pulsar `Consultar documento`.
  3. En `IPS destino permiso`, usar `IPS-002`.
  4. Pulsar `Otorgar`, luego `Revocar`.
- Resultado esperado:
  - Se muestra `Hash` del documento cuando hay acceso.
  - Cambia listado `IPS autorizadas` tras otorgar/revocar.

### HU2-E5 - DApp integrada como interfaz operativa
- Rutas UI: `/`, `/portal`, `/episodios`, `/infraestructura`, `/episodios/trazabilidad`
- Pasos:
  1. Recorrer menu principal completo.
  2. Validar navegacion sin errores entre modulos.
  3. Verificar estados de exito/error en tarjetas y formularios.
- Resultado esperado:
  - Flujo integrado sin pantallas rotas.
  - Mensajes claros ante errores y acciones exitosas.

### HU5-E1 - Restriccion de creacion/modificacion de episodios por rol
- Rutas UI: `/episodios/crear`, `/episodios/actualizar`
- Pasos:
  1. Iniciar sesion como `paciente`.
  2. Intentar registrar o actualizar episodio.
  3. Repetir con `profesional_salud`.
- Resultado esperado:
  - Rol no autorizado: accion rechazada (mensaje de error).
- Rol autorizado: operacion permitida.

## Sprint 4

### HU3-E5 - Autenticacion y autorizacion desde la DApp
- Ruta UI: `/login`
- Pasos:
  1. Abrir `Iniciar sesion`.
  2. Usar una de las credenciales de validacion visibles en pantalla.
  3. Entrar al portal.
- Resultado esperado:
  - La sesion muestra `rol`, `IPS`, `usuario` y expiracion.
  - No se piden rol ni IPS manualmente.
  - Al cerrar sesion, las rutas protegidas redirigen al login.

### HU0-E2 / HU1-E2 / HU2-E4 - Permisos entre IPS con trazabilidad
- Ruta UI: `/portal`
- Rol para prueba positiva: `admin_ips`
- Pasos:
  1. Consultar un episodio existente en `Documentos, permisos e integridad`.
  2. Ingresar `IPS-002` como IPS destino.
  3. Pulsar `Otorgar`.
  4. Confirmar que `IPS-002` aparece en `IPS autorizadas`.
  5. Pulsar `Revocar`.
- Resultado esperado:
  - Cambia el estado efectivo del acceso.
  - Se muestra evidencia de traza para otorgar/revocar.
  - La vista de trazabilidad muestra ambos eventos.

### HU0-E4 / HU1-E4 - Creacion y actualizacion con trazabilidad
- Rutas UI: `/episodios/crear`, `/episodios/actualizar`, `/episodios/trazabilidad`
- Pasos:
  1. Crear un episodio.
  2. Actualizar el mismo episodio.
  3. Abrir `Trazabilidad`.
- Resultado esperado:
  - La respuesta de crear/actualizar muestra hash y traza.
  - La tabla de versiones conserva ambas versiones.
  - La tabla de eventos muestra `EPISODE_CREATED` y `EPISODE_UPDATED`.

### HU3-E1 / HU4-E4 - Verificacion de integridad por hashes
- Ruta UI: `/episodios/trazabilidad`
- Pasos:
  1. Consultar un episodio trazado.
  2. Revisar la tarjeta `Verificacion de integridad`.
- Resultado esperado:
  - Se muestran `Hash on-chain` y `Hash off-chain`.
  - El estado indica `Integro` o `Inconsistente`.
  - Se muestra evidencia de la transaccion/traza fuente.

## 5. Casos negativos minimos de interfaz (obligatorios)

1. Login sin correo/contrasena -> muestra error.
2. Crear episodio con campos obligatorios vacios -> muestra validaciones.
3. Actualizar sin `ID episodio` -> mensaje "Debe indicar el ID...".
4. Trazabilidad sin `ID episodio` -> mensaje de error.
5. Portal con rol sin permisos -> botones bloqueados + alerta.

## 6. Formato de registro por HU (acta rapida)

```md
HU:
Ruta UI:
Rol usado:
Fecha:

Pasos ejecutados:
1)
2)
3)

Resultado esperado:
Resultado obtenido:
Estado: CUMPLIDA / CUMPLIDA CON OBSERVACIONES / NO CUMPLIDA
Evidencia: captura o texto del mensaje mostrado en UI
```

## 7. Criterio de cierre frontend

Se considera validado frontend cuando:

- Todas las HU con impacto UI quedan en estado `CUMPLIDA` o `CUMPLIDA CON OBSERVACIONES`.
- No hay bloqueantes funcionales en navegacion principal.
- Los casos negativos minimos muestran feedback claro al usuario.
