import { z } from 'zod';

export const emailSchema = z.string().trim().min(1, 'Informe o e-mail').email('E-mail inválido');
export const passwordSchema = z.string().min(6, 'A senha precisa ter pelo menos 6 caracteres');
export const nameSchema = z.string().trim().min(2, 'Informe pelo menos 2 caracteres');

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Informe a senha'),
});

export const signupSchema = z.object({
  fullName: nameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  password: passwordSchema,
});

export const courseSchema = z.object({
  title: z.string().trim().min(2, 'Dê um nome para o curso'),
  description: z.string().trim().max(2000, 'Descrição muito longa').optional().default(''),
});

export const addStudentSchema = z.object({
  fullName: z.string().trim().max(120, 'Nome muito longo').optional().default(''),
  email: emailSchema,
});

export const lessonSchema = z.object({
  title: z.string().trim().min(2, 'Dê um nome para a aula'),
});

/** Runs a zod schema and returns a flat field->message error map instead of throwing. */
export function validate<T extends z.ZodTypeAny>(
  schema: T,
  values: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: Record<string, string> } {
  const result = schema.safeParse(values);
  if (result.success) return { success: true, data: result.data };

  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const key = issue.path.join('.') || '_root';
    if (!errors[key]) errors[key] = issue.message;
  }
  return { success: false, errors };
}
