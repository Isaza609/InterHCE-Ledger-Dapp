import type { RolSesion, SesionUsuario } from "./sessionStorage";

const CAPABILIDADES_POR_ROL: Record<RolSesion, string[]> = {
  super_admin: [
    "ips.crear",
    "ips.actualizar",
    "ips.listar",
    "ips.usuarios.gestionar",
    "ips.permisos.gestionar",
    "episodios.consultar",
    "episodios.documento.ver",
    "sistema.configurar",
    "trazabilidad.consultar"
  ],
  profesional_salud: [
    "episodios.crear",
    "episodios.actualizar",
    "episodios.consultar",
    "episodios.documento.ver",
    "trazabilidad.consultar"
  ],
  admin_ips: [
    "episodios.crear",
    "episodios.actualizar",
    "episodios.consultar",
    "episodios.documento.ver",
    "ips.usuarios.gestionar",
    "ips.permisos.gestionar",
    "trazabilidad.consultar"
  ],
  paciente: ["episodios.consultar"],
  auditor: ["trazabilidad.consultar", "evaluacion.consultar"]
};

export function obtenerCapacidadesSesion(
  sesion: SesionUsuario | null
): string[] {
  if (!sesion) return [];
  return CAPABILIDADES_POR_ROL[sesion.rol] ?? [];
}

export function sesionTieneCapacidad(
  sesion: SesionUsuario | null,
  capacidad: string
): boolean {
  return obtenerCapacidadesSesion(sesion).includes(capacidad);
}
