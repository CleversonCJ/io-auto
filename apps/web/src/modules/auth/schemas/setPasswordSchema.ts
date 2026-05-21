import { z } from "zod";

export const setPasswordSchema = z.object({
    password: z.string().min(8, "A senha deve conter no minimo 8 caracteres."),
    confirmPassword: z.string().min(8, "Confirme a senha com no minimo 8 caracteres."),
}).refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
});

export type SetPasswordFormValues = z.infer<typeof setPasswordSchema>;
