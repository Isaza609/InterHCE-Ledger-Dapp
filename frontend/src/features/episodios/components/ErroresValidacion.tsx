import type { ValidationIssue } from "@/shared/types/episodio";

interface ErroresValidacionProps {
  issues: ValidationIssue[];
}

export function ErroresValidacion({ issues }: ErroresValidacionProps) {
  if (!issues.length) return null;
  return (
    <div
      role="alert"
      className="alert alert--error"
      style={{ marginTop: "1rem" }}
      aria-labelledby="errores-validacion-titulo"
    >
      <strong id="errores-validacion-titulo">
        Errores de validación (modelo HCE):
      </strong>
      <ul style={{ margin: "0.5rem 0 0 1rem", paddingLeft: "1rem" }}>
        {issues.map((item, i) => (
          <li key={i}>
            <code>{item.field}</code>: {item.issue}
          </li>
        ))}
      </ul>
    </div>
  );
}
