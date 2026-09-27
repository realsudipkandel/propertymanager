export type FormState = {
  message: string | null;
  fieldErrors: Record<string, string>;
};

export const idleFormState: FormState = {
  message: null,
  fieldErrors: {},
};

export function invalidForm(message: string, fieldErrors: Record<string, string> = {}): FormState {
  return { message, fieldErrors };
}
