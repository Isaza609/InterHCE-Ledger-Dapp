"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.openApiSpec = void 0;
exports.openApiSpec = {
    openapi: "3.0.0",
    info: {
        title: "InterHCE Backend API",
        version: "0.1.0",
        description: "API off-chain para validación y manejo de episodios clínicos de urgencias (Épica 0)."
    },
    servers: [
        {
            url: "http://localhost:3001",
            description: "Desarrollo local"
        }
    ],
    paths: {
        "/health": {
            get: {
                summary: "Estado del servicio",
                description: "Permite verificar que el backend de InterHCE Ledger está levantado y respondiendo correctamente.",
                responses: {
                    "200": {
                        description: "Servicio operativo"
                    }
                }
            }
        },
        "/auth/login": {
            post: {
                summary: "Iniciar sesión en la plataforma (HU3-E5)",
                description: "Autentica al usuario contra el backend y devuelve la sesión con token, rol e IPS activa para consumir rutas protegidas.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    correo: { type: "string" },
                                    usuarioId: { type: "string" },
                                    password: { type: "string" }
                                },
                                required: ["password"]
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Sesión iniciada correctamente" },
                    "401": { description: "Credenciales inválidas" },
                    "403": { description: "Usuario inactivo" }
                }
            }
        },
        "/auth/me": {
            get: {
                summary: "Consultar la sesión autenticada actual (HU3-E5)",
                parameters: [
                    {
                        name: "authorization",
                        in: "header",
                        required: true,
                        schema: { type: "string" },
                        description: "Bearer token devuelto por /auth/login"
                    }
                ],
                responses: {
                    "200": { description: "Sesión vigente" },
                    "401": { description: "Sesión inexistente o expirada" }
                }
            }
        },
        "/auth/logout": {
            post: {
                summary: "Cerrar sesión del usuario autenticado (HU3-E5)",
                parameters: [
                    {
                        name: "authorization",
                        in: "header",
                        required: true,
                        schema: { type: "string" },
                        description: "Bearer token devuelto por /auth/login"
                    }
                ],
                responses: {
                    "200": { description: "Sesión invalidada" },
                    "400": { description: "Falta token" }
                }
            }
        },
        "/episodes/validate": {
            post: {
                summary: "Validar estructuralmente un episodio clínico de urgencias",
                description: "Recibe un episodio clínico de urgencias y lo valida contra el modelo mínimo de HCE definido en la Épica 0. No registra ni modifica datos; solo devuelve si la estructura es válida o cuáles son los errores.",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/EpisodioFhirLike"
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Episodio válido estructuralmente"
                    },
                    "400": {
                        description: "Errores de validación estructural",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ValidationErrorResponse"
                                }
                            }
                        }
                    }
                }
            }
        },
        "/episodes": {
            post: {
                summary: "Registrar un nuevo episodio clínico (validación incluida)",
                description: "HU0-E1. Requiere rol autorizado (profesional_salud o admin_ips) e IPS del actor. Valida el episodio contra el modelo HCE/FHIR, genera documento off-chain, hash y metadatos on-chain sin datos clínicos.",
                parameters: [
                    {
                        name: "x-user-role",
                        in: "header",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-ips-id",
                        in: "header",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-user-id",
                        in: "header",
                        required: false,
                        schema: { type: "string" }
                    }
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/EpisodioFhirLike"
                            }
                        }
                    }
                },
                responses: {
                    "201": {
                        description: "Episodio válido y aceptado para persistencia off-chain / registro on-chain"
                    },
                    "400": {
                        description: "Errores de validación estructural",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ValidationErrorResponse"
                                }
                            }
                        }
                    }
                }
            }
        },
        "/episodes/{id}": {
            put: {
                summary: "Actualizar un episodio clínico existente (validación incluida)",
                description: "HU1-E1. Requiere rol autorizado (profesional_salud o admin_ips). Crea una nueva versión off-chain del episodio, recalcula hash y mantiene trazabilidad histórica sin sobrescribir versiones previas.",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-user-role",
                        in: "header",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-ips-id",
                        in: "header",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-user-id",
                        in: "header",
                        required: false,
                        schema: { type: "string" }
                    }
                ],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                $ref: "#/components/schemas/EpisodioFhirLike"
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Episodio actualizado tras pasar validación estructural"
                    },
                    "400": {
                        description: "Errores de validación estructural",
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ValidationErrorResponse"
                                }
                            }
                        }
                    }
                }
            }
        },
        "/episodes/{id}/document": {
            get: {
                summary: "Recuperar documento clínico off-chain (HU3-E0)",
                description: "Devuelve el documento clínico asociado al episodio, almacenado off-chain. Requiere actor autorizado y permiso válido por IPS (HU4-E5).",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Identificador único del episodio"
                    },
                    {
                        name: "x-user-role",
                        in: "header",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-ips-id",
                        in: "header",
                        required: false,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-user-id",
                        in: "header",
                        required: false,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": {
                        description: "Documento clínico off-chain y hash de integridad"
                    },
                    "404": {
                        description: "No existe documento asociado a este episodio"
                    }
                }
            }
        },
        "/episodes/{id}/onchain-metadata": {
            get: {
                summary: "Generar metadatos para registro on-chain sin datos clínicos (HU4-E0)",
                description: "Devuelve exclusivamente hashes y metadatos no sensibles derivados del documento off-chain del episodio. No expone ni persiste estructura clínica en la capa on-chain.",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" },
                        description: "Identificador único del episodio"
                    }
                ],
                responses: {
                    "200": {
                        description: "Metadatos on-chain listos para registrar trazabilidad"
                    },
                    "404": {
                        description: "No existe documento asociado al episodio"
                    }
                }
            }
        },
        "/episodes/{id}/event": {
            get: {
                summary: "Consultar evento de urgencias asociado al episodio (HU4-E1)",
                description: "Devuelve la asociación única episodio-evento (fecha inicio, IPS origen y tipo de atención) mantenida durante todo el ciclo de vida.",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": { description: "Evento de urgencias asociado" },
                    "404": { description: "No existe evento asociado al episodio" }
                }
            }
        },
        "/episodes/{id}/versions": {
            get: {
                summary: "Consultar historial de versiones del episodio (HU1-E1)",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": { description: "Listado de versiones del episodio" },
                    "404": { description: "No existe historial para el episodio" }
                }
            }
        },
        "/episodes/{id}/traceability": {
            get: {
                summary: "Consultar trazabilidad completa del episodio (HU1-E1/HU4-E1)",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": { description: "Trazabilidad con evento y versiones" },
                    "404": { description: "No existe trazabilidad para el episodio" }
                }
            }
        },
        "/episodes/{id}/integrity": {
            get: {
                summary: "Verificar integridad del episodio (HU3-E1/HU4-E4)",
                description: "Compara el hash documental off-chain con la evidencia registrada en trazabilidad y devuelve el resultado de integridad sin exponer datos clínicos sensibles.",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": { description: "Resultado de verificación de integridad" },
                    "404": { description: "No existe evidencia suficiente para validar integridad" }
                }
            }
        },
        "/episodes/{id}/permissions": {
            get: {
                summary: "Consultar IPS con acceso al documento del episodio (HU4-E5)",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    },
                    {
                        name: "x-user-role",
                        in: "header",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": { description: "Permisos vigentes por IPS" }
                }
            }
        },
        "/episodes/{id}/permissions/grant": {
            post: {
                summary: "Otorgar permiso de lectura de documento a otra IPS (HU4-E5)",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    targetIpsId: { type: "string" }
                                },
                                required: ["targetIpsId"]
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Permiso otorgado" },
                    "403": { description: "No autorizado" }
                }
            }
        },
        "/episodes/{id}/permissions/revoke": {
            post: {
                summary: "Revocar permiso de lectura de documento a una IPS (HU4-E5)",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    targetIpsId: { type: "string" }
                                },
                                required: ["targetIpsId"]
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Permiso revocado" },
                    "403": { description: "No autorizado" }
                }
            }
        },
        "/infra/status": {
            get: {
                summary: "Estado de infraestructura del prototipo (HU1-E5)",
                description: "Entrega estado de backend, modo blockchain real o simulado, salud de la RPC, conectividad off-chain y simulación multi-IPS.",
                responses: {
                    "200": { description: "Estado de infraestructura" }
                }
            }
        },
        "/infra/ips": {
            get: {
                summary: "Listar IPS simuladas del entorno de prototipo (HU1-E5)",
                responses: {
                    "200": { description: "Listado de IPS simuladas" }
                }
            },
            post: {
                summary: "Configurar IPS simuladas del entorno de prototipo (HU1-E5)",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    ips: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            properties: {
                                                ipsId: { type: "string" },
                                                nombre: { type: "string" },
                                                repsCodigo: { type: "string" }
                                            },
                                            required: ["ipsId", "nombre", "repsCodigo"]
                                        }
                                    }
                                },
                                required: ["ips"]
                            }
                        }
                    }
                },
                responses: {
                    "200": { description: "Configuración de IPS actualizada" },
                    "400": { description: "Configuración inválida" }
                }
            }
        },
        "/infra/contracts/mock-deploy": {
            post: {
                summary: "Marcar contratos como operativos en modo simulado (HU1-E5)",
                responses: {
                    "200": { description: "Estado de contratos simulado actualizado" }
                }
            }
        },
        "/access/roles": {
            get: {
                summary: "Listar roles y capacidades del sistema (HU0-E3)",
                responses: {
                    "200": { description: "Roles del sistema" }
                }
            }
        },
        "/access/capabilities": {
            get: {
                summary: "Consultar capacidades disponibles para el rol activo (HU1-E3)",
                responses: {
                    "200": { description: "Capacidades del rol" }
                }
            }
        },
        "/access/users": {
            get: {
                summary: "Listar usuarios de la IPS del administrador (HU2-E3)",
                responses: {
                    "200": { description: "Usuarios de IPS" },
                    "403": { description: "No autorizado" }
                }
            },
            post: {
                summary: "Crear usuario dentro de una IPS (HU2-E3)",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    usuarioId: { type: "string" },
                                    nombre: { type: "string" },
                                    rol: { type: "string" }
                                },
                                required: ["usuarioId", "nombre", "rol"]
                            }
                        }
                    }
                },
                responses: {
                    "201": { description: "Usuario creado" },
                    "403": { description: "No autorizado" }
                }
            }
        },
        "/access/users/{id}": {
            patch: {
                summary: "Actualizar rol/estado de usuario de IPS (HU2-E3)",
                parameters: [
                    {
                        name: "id",
                        in: "path",
                        required: true,
                        schema: { type: "string" }
                    }
                ],
                responses: {
                    "200": { description: "Usuario actualizado" },
                    "403": { description: "No autorizado" }
                }
            }
        }
    },
    components: {
        schemas: {
            EpisodioFhirLike: {
                type: "object",
                properties: {
                    patient: {
                        $ref: "#/components/schemas/FhirPatient"
                    },
                    encounter: {
                        $ref: "#/components/schemas/FhirEncounter"
                    },
                    prestadorOrigen: { $ref: "#/components/schemas/FhirOrganization" },
                    prestadorDestino: { $ref: "#/components/schemas/FhirOrganization" },
                    diagnosticoIngreso: { $ref: "#/components/schemas/FhirCondition" },
                    diagnosticoEgreso: { $ref: "#/components/schemas/FhirCondition" },
                    otrosDiagnosticos: {
                        type: "array",
                        items: { $ref: "#/components/schemas/FhirCondition" }
                    }
                },
                required: ["patient", "encounter", "prestadorOrigen", "diagnosticoIngreso"]
            },
            FhirIdentifier: {
                type: "object",
                properties: {
                    system: { type: "string", format: "uri" },
                    value: { type: "string" }
                },
                required: ["value"]
            },
            FhirCodeableConcept: {
                type: "object",
                properties: {
                    coding: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                system: { type: "string", format: "uri" },
                                code: { type: "string" },
                                display: { type: "string" }
                            },
                            required: ["code"]
                        }
                    },
                    text: { type: "string" }
                }
            },
            FhirReference: {
                type: "object",
                properties: {
                    reference: { type: "string" },
                    display: { type: "string" }
                }
            },
            FhirPatient: {
                type: "object",
                properties: {
                    resourceType: { type: "string", enum: ["Patient"] },
                    identifier: {
                        type: "array",
                        items: { $ref: "#/components/schemas/FhirIdentifier" }
                    },
                    name: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                family: { type: "string" },
                                given: {
                                    type: "array",
                                    items: { type: "string" }
                                }
                            },
                            required: ["family", "given"]
                        }
                    },
                    birthDate: { type: "string", format: "date" },
                    gender: {
                        type: "string",
                        enum: ["male", "female", "other", "unknown"]
                    }
                },
                required: ["resourceType", "identifier", "name", "birthDate"]
            },
            FhirEncounter: {
                type: "object",
                properties: {
                    resourceType: { type: "string", enum: ["Encounter"] },
                    status: {
                        type: "string",
                        enum: ["planned", "in-progress", "finished"]
                    },
                    class: { $ref: "#/components/schemas/FhirCodeableConcept" },
                    type: {
                        type: "array",
                        items: { $ref: "#/components/schemas/FhirCodeableConcept" }
                    },
                    subject: { $ref: "#/components/schemas/FhirReference" },
                    serviceProvider: { $ref: "#/components/schemas/FhirReference" },
                    period: {
                        type: "object",
                        properties: {
                            start: { type: "string", format: "date-time" },
                            end: { type: "string", format: "date-time" }
                        },
                        required: ["start"]
                    },
                    reasonCode: {
                        type: "array",
                        items: { $ref: "#/components/schemas/FhirCodeableConcept" }
                    }
                },
                required: [
                    "resourceType",
                    "status",
                    "class",
                    "subject",
                    "serviceProvider",
                    "period"
                ]
            },
            FhirCondition: {
                type: "object",
                properties: {
                    resourceType: { type: "string", enum: ["Condition"] },
                    code: { $ref: "#/components/schemas/FhirCodeableConcept" },
                    subject: { $ref: "#/components/schemas/FhirReference" },
                    encounter: { $ref: "#/components/schemas/FhirReference" },
                    category: {
                        type: "array",
                        items: { $ref: "#/components/schemas/FhirCodeableConcept" }
                    }
                },
                required: ["resourceType", "code", "subject"]
            },
            FhirOrganization: {
                type: "object",
                properties: {
                    resourceType: { type: "string", enum: ["Organization"] },
                    identifier: {
                        type: "array",
                        items: { $ref: "#/components/schemas/FhirIdentifier" }
                    },
                    name: { type: "string" }
                },
                required: ["resourceType", "identifier"]
            },
            ValidationErrorResponse: {
                type: "object",
                properties: {
                    code: { type: "string", example: "VALIDATION_ERROR" },
                    message: { type: "string" },
                    details: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                field: { type: "string" },
                                issue: { type: "string" }
                            }
                        }
                    }
                },
                required: ["code", "message"]
            }
        }
    }
};
