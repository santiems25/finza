"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FinzaLogo } from "@/components/layout/finza-logo";
import { signUp } from "@/lib/supabase";

export default function RegisterPage() {
  const router = useRouter();
  const [email,     setEmail]     = useState("");
  const [password,  setPassword]  = useState("");
  const [password2, setPassword2] = useState("");
  const [showPass,  setShowPass]  = useState(false);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [success,   setSuccess]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== password2) {
      setError("Las contraseñas no coinciden");
      return;
    }
    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres");
      return;
    }

    setLoading(true);
    try {
      const data = await signUp(email, password);
      // Si Supabase requiere confirmación de email, session viene null
      if (!data.session) {
        setSuccess(true);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al registrarse";
      if (message.includes("User already registered")) {
        setError("Ya existe una cuenta con ese email");
      } else if (message.includes("Password should be")) {
        setError("La contraseña debe tener al menos 6 caracteres");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-background to-violet-950/20 pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <FinzaLogo size="lg" />
        </div>

        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="pb-2 text-center">
            <p className="text-muted-foreground text-sm">
              Creá tu cuenta para empezar
            </p>
          </CardHeader>

          <CardContent>
            {success ? (
              /* Estado: registro exitoso, pendiente de confirmación */
              <div className="space-y-4 text-center py-2">
                <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
                  <UserPlus className="h-7 w-7 text-emerald-400" />
                </div>
                <div>
                  <p className="font-semibold">¡Cuenta creada!</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Revisá tu email y confirmá tu cuenta antes de ingresar.
                  </p>
                </div>
                <Link href="/login">
                  <Button variant="outline" className="w-full">
                    Ir al inicio de sesión
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Email */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Email</Label>
                  <Input
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    autoComplete="email"
                    required
                    className="h-11"
                  />
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Contraseña</Label>
                  <div className="relative">
                    <Input
                      type={showPass ? "text" : "password"}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      autoComplete="new-password"
                      required
                      className="h-11 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass(s => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                {/* Repetir contraseña */}
                <div className="space-y-1.5">
                  <Label className="text-sm">Repetir contraseña</Label>
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="Repetí la contraseña"
                    value={password2}
                    onChange={e => setPassword2(e.target.value)}
                    autoComplete="new-password"
                    required
                    className="h-11"
                  />
                </div>

                {/* Error */}
                {error && (
                  <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                {/* Botón */}
                <Button
                  type="submit"
                  className="w-full h-11 gap-2 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 border-0 text-base font-medium"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Creando cuenta...
                    </span>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Crear cuenta
                    </>
                  )}
                </Button>

                {/* Link a login */}
                <p className="text-center text-sm text-muted-foreground">
                  ¿Ya tenés cuenta?{" "}
                  <Link href="/login" className="text-primary hover:underline font-medium">
                    Iniciá sesión
                  </Link>
                </p>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
