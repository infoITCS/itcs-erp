import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { AuthLayout } from "@/components/layouts/AuthLayout.tsx";
import { FormField } from "@/components/forms/FormField.tsx";
import { Button } from "@/components/ui/Button.tsx";
import { Input } from "@/components/ui/Input.tsx";
import { tokenStore } from "@/lib/token-store.ts";
import { login } from "@/services/auth.ts";
import { getApiErrorMessage } from "@/utils/api-error.ts";

const loginSchema = z.object({
  email: z.string().trim().email({ error: "Enter a valid email" }),
  password: z.string().min(8, { error: "Use at least 8 characters" }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export function LoginPage() {
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  return (
    <AuthLayout>
      <h1 className="text-xl font-semibold text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-600">Use the administrator account created by the Phase 1 seed.</p>
      <form
        className="mt-6 flex flex-col gap-4"
        noValidate
        onSubmit={form.handleSubmit(async (values) => {
          setFormError(null);
          try {
            const result = await login(values);
            if (result.data?.accessToken && result.data.refreshToken && result.data.user) {
              tokenStore.setSession({
                accessToken: result.data.accessToken,
                refreshToken: result.data.refreshToken,
                email: result.data.user.email,
              });
              navigate("/");
            }
          } catch (error) {
            setFormError(getApiErrorMessage(error));
          }
        })}
      >
        <FormField label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
          <Input id="email" type="email" autoComplete="username" {...form.register("email")} />
        </FormField>
        <FormField label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            {...form.register("password")}
          />
        </FormField>
        {formError ? <p className="text-sm text-red-700">{formError}</p> : null}
        <Button type="submit" disabled={form.formState.isSubmitting}>
          {form.formState.isSubmitting ? "Signing in…" : "Sign in"}
        </Button>
      </form>
      <Link to="/" className="mt-4 inline-block text-sm text-slate-600">
        Back to the shell
      </Link>
    </AuthLayout>
  );
}
