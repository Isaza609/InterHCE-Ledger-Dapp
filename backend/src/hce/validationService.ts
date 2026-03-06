import {
  episodioFhirLikeSchema,
  EpisodioFhirLikeInput
} from "./hceValidationSchema";

export interface ValidationIssue {
  field: string;
  issue: string;
}

export interface ValidationResult {
  valid: boolean;
  issues?: ValidationIssue[];
}

export function validateEpisodioClinico(
  payload: unknown
): ValidationResult & { data?: EpisodioFhirLikeInput } {
  const result = episodioFhirLikeSchema.safeParse(payload);

  if (!result.success) {
    const issues: ValidationIssue[] = result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      issue: issue.message
    }));

    return {
      valid: false,
      issues
    };
  }

  return {
    valid: true,
    data: result.data
  };
}

