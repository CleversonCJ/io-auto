import { z } from "zod";

export const setPasswordSchema = z.object({
    password: z.string().min(6, "A senha deve ter pelo menos 6 caracteres."),
    confirmPassword: z.string().min(6, "Confirme a senha com pelo menos 6 caracteres."),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
});

export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;
