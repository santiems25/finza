"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { FinzaLogo } from "@/components/layout/finza-logo";
import { signIn } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signIn(email, password);
      router.push("/");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al iniciar sesión";
      // Mensaje amigable en español
      if (message.includes("Invalid login credentials")) {
        setError("Email o contraseña incorrectos");
      } else if (message.includes("Email not confirmed")) {
        setError("Confirmá tu email antes de ingresar");
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-background">
      {/* Fondo con gradiente sutil */}
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950/30 via-background to-violet-950/20 pointer-events-none" />

      <div className="w-full max-w-sm relative">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <FinzaLogo size="lg" />
        </div>

        <Card className="border-border/50 shadow-2xl">
          <CardHeader className="pb-2 text-center">
            <p className="text-muted-foreground text-sm">
              Ingresá para acceder a tus finanzas
            </p>
          </CardHeader>

          <CardContent>
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
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-11 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(s => !s)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showPass
                      ? <EyeOff className="h-4 w-4" />
                      : <Eye className="h-4 w-4" />}
                  </button>
                </div>
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
                    Ingresando...
                  </span>
                ) : (
                  <>
                    <LogIn className="h-4 w-4" />
                    Ingresar
                  </>
                )}
              </Button>

                {/* Link a registro */}
                <p className="text-center text-sm text-muted-foreground">
                  ¿No tenés cuenta?{" "}
                  <Link href="/register" className="text-primary hover:underline font-medium">
                    Registrate
                  </Link>
                </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
