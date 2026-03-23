import catalogosRaw from "../../../../docs_plan/catalogos_rda.json";

export interface CatalogOption {
  code: string;
  display: string;
}

interface CatalogoEntry {
  valores?: CatalogOption[];
}

const catalogos = (catalogosRaw as { catalogos: Record<string, CatalogoEntry> }).catalogos;

function readCatalog(key: string): CatalogOption[] {
  return catalogos[key]?.valores ?? [];
}

export const rdaCatalogos = {
  tipoDocumentoPersona: readCatalog("tipoDocumentoPersona"),
  epsAdres: readCatalog("epsAdres"),
  paises: readCatalog("paisesIso3166_1_alpha2"),
  ocupacion: readCatalog("ocupacionCuocDane"),
  municipios: readCatalog("municipiosDivipolaDane"),
  zonaTerritorial: readCatalog("zonaTerritorial"),
  modalidadTecnologiaSalud: readCatalog("modalidadTecnologiaSalud"),
  grupoServicios: readCatalog("grupoServicios"),
  entornoAtencion: readCatalog("entornoAtencion"),
  viaIngresoUsuario: readCatalog("viaIngresoUsuario"),
  causaMotivaAtencion: readCatalog("causaMotivaAtencion"),
  triageClasificacion: readCatalog("triageClasificacion"),
  condicionDestinoEgreso: readCatalog("condicionDestinoEgreso"),
  tipoDiagnostico: readCatalog("tipoDiagnostico"),
  identidadGenero: readCatalog("identidadGenero"),
  etnia: readCatalog("etnia")
};

export function getDisplayByCode(options: CatalogOption[], code: string): string {
  return options.find((option) => option.code === code)?.display ?? "";
}
