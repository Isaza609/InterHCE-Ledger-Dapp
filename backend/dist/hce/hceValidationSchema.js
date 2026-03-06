"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.episodioClinicoUrgenciasSchema = void 0;
const zod_1 = require("zod");
exports.episodioClinicoUrgenciasSchema = zod_1.z.object({
    prestador: zod_1.z.object({
        codigoPrestador: zod_1.z.string().min(6).max(12)
    }),
    paciente: zod_1.z.object({
        tipoDocumento: zod_1.z.string().min(2).max(3),
        numeroDocumento: zod_1.z.string().regex(/^[0-9]{6,15}$/),
        primerApellido: zod_1.z.string().min(1).max(60),
        segundoApellido: zod_1.z.string().max(60).optional(),
        primerNombre: zod_1.z.string().min(1).max(60),
        segundoNombre: zod_1.z.string().max(60).optional()
    }),
    socioDemograficos: zod_1.z.object({
        fechaHoraNacimiento: zod_1.z
            .string()
            .datetime({ offset: false }),
        codigoPaisNacionalidad: zod_1.z.string().length(2),
        sexoBiologico: zod_1.z.enum(["M", "F"])
    }),
    urgencia: zod_1.z.object({
        fechaHoraInicioAtencion: zod_1.z.string().datetime({ offset: false }),
        fechaHoraFinAtencion: zod_1.z.string().datetime({ offset: false }),
        triageClasificacion: zod_1.z.enum(["I", "II", "III", "IV", "V"]),
        entornoAtencion: zod_1.z.string().min(1),
        causaMotivoAtencion: zod_1.z.string().min(1)
    }),
    diagnosticoIngreso: zod_1.z.object({
        codigoCIE10: zod_1.z.string().min(1),
        nombreCIE10: zod_1.z.string().min(1).max(200),
        tipoDiagnostico: zod_1.z.enum(["P", "R", "C"])
    }),
    diagnosticoEgreso: zod_1.z.object({
        codigoCIE10: zod_1.z.string().min(1),
        nombreCIE10: zod_1.z.string().min(1).max(200),
        tipoDiagnostico: zod_1.z.enum(["P", "R", "C"])
    })
});
