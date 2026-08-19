interface SchemaError {
  readonly instancePath: string;
  readonly keyword: string;
  readonly params: Readonly<Record<string, unknown>>;
  readonly message?: string;
}
declare function validateProjectSchema(value: unknown): boolean;
declare namespace validateProjectSchema {
  let errors: readonly SchemaError[] | null;
}
export default validateProjectSchema;
