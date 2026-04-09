"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, User } from "lucide-react";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Usuario o contraseña incorrectos");
      } else {
        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError("Ocurrió un error al intentar ingresar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0d0d0d] p-4 relative overflow-hidden">
      {/* Background blobs for premium look */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#FFCC00]/5 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#FFCC00]/5 rounded-full blur-[120px] pointer-events-none"></div>

      <Card className="w-full max-w-md bg-[#161616] border-[#2a2a2a] shadow-2xl relative z-10">
        <CardHeader className="space-y-4 flex flex-col items-center">
            <div className="w-16 h-16 bg-[#FFCC00]/10 rounded-2xl flex items-center justify-center border border-[#FFCC00]/20 mb-2">
                <img src="/logo-caec.png" alt="Logo CAEC" className="w-10 h-10 object-contain" />
            </div>
          <div className="text-center">
            <CardTitle className="text-2xl font-bold text-white tracking-tight">Acceso Administrativo</CardTitle>
            <CardDescription className="text-[#999999] mt-1">Ingresá tus credenciales para continuar</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-white text-xs font-semibold uppercase tracking-wider">Usuario</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <Input
                  id="username"
                  type="text"
                  placeholder="Ej: TenisCAEC"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-white pl-10 h-11 focus:border-[#FFCC00] transition-colors"
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" title="password" className="text-white text-xs font-semibold uppercase tracking-wider">Contraseña</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-[#0d0d0d] border-[#2a2a2a] text-white pl-10 h-11 focus:border-[#FFCC00] transition-colors"
                  required
                />
              </div>
            </div>
            
            {error && (
              <div className="bg-[#EF4444]/10 border border-[#EF4444]/20 text-[#EF4444] text-xs py-2 px-3 rounded-lg animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#FFCC00] text-[#0d0d0d] hover:bg-[#E6B800] font-bold h-11 rounded-xl shadow-lg shadow-[#FFCC00]/10 mt-2 transition-all active:scale-[0.98]"
            >
              {loading ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Ingresando...</span>
                </div>
              ) : (
                "Ingresar"
              )}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="flex flex-col items-center gap-4 pt-2">
          <p className="text-[#444444] text-[10px] uppercase font-bold tracking-[0.1em]">
            CAEC Tenis · Panel de Control v2.0
          </p>
        </CardFooter>
      </Card>
      
      {/* Footer text */}
      <div className="absolute bottom-6 left-0 w-full text-center">
        <p className="text-[#333333] text-xs">Empalme Central Tenis © {new Date().getFullYear()}</p>
      </div>
    </div>
  );
}
