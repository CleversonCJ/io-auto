import { z } from "zod";

export const loginSchema = z.object({
    email: z
        .string()
        .trim()
        .min(1, "Informe seu e-mail.")
        .email("Digite um e-mail valido."),
    password: z
        .string()
        .min(1, "Informe sua senha.")
        .min(8, "Sua senha deve conter no minimo 8 caracteres."),
});

export type LoginForm = z.infer<typeof loginSchema>;
