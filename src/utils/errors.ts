const KNOWN_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-mail ou senha incorretos.',
  'User already registered': 'Já existe uma conta com este e-mail.',
  'Email not confirmed': 'Confirme seu e-mail antes de entrar.',
  'Not authenticated': 'Sua sessão expirou. Faça login novamente.',
};

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return KNOWN_MESSAGES[error.message] ?? error.message;
  }
  if (typeof error === 'string') return error;
  return 'Ocorreu um erro inesperado. Tente novamente.';
}
