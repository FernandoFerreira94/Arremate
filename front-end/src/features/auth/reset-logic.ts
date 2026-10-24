/** R1: redefinição SIMULADA. Nunca chama a API e responde sempre igual, exista ou não o e-mail. */
export const RESET_SENT_MESSAGE = "Se o e-mail existir, enviamos um link.";
export const RESET_SENT_DETAIL = "Confira a caixa de entrada e o spam. Na demonstração nenhum e-mail é enviado de fato.";

export function isPlausibleEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Medidor de força só visual (0 a 4). O cadastro real e as regras de senha chegam com a integração. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0;
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password) && /[^A-Za-z0-9]/.test(password)) score++;
  return Math.max(1, score) as 1 | 2 | 3 | 4;
}
export const STRENGTH_LABEL = ["", "Fraca", "Razoável", "Boa", "Forte"] as const;
