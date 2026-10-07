export type FormState = {
  message: string | null;
  fieldErrors: Record<string, string>;
  inviteUrl: string | null;
  ok: boolean;
};

export const idleFormState: FormState = {
  message: null,
  fieldErrors: {},
  inviteUrl: null,
  ok: false,
};

export function invalidForm(message: string, fieldErrors: Record<string, string> = {}): FormState {
  return { message, fieldErrors, inviteUrl: null, ok: false };
}

export function inviteReady(inviteUrl: string): FormState {
  return {
    message: "Invite link ready. Share it with that person. It expires in 7 days.",
    fieldErrors: {},
    inviteUrl,
    ok: true,
  };
}

export function completedForm(message: string): FormState {
  return { message, fieldErrors: {}, inviteUrl: null, ok: true };
}
