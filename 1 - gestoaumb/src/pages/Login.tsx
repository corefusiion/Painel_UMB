import { useState } from "react";
import { API_URL } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { LogIn, Loader2 } from "lucide-react";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    localStorage.setItem('token', 'mock-jwt-token');
    const error = null;
    setLoading(false);

    if (error) {
      toast.error("Credenciais inválidas. Verifique e tente novamente.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-[hsl(234,50%,8%)]">
      {/* Animated pulsing lines */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-[hsl(217,45%,45%/0.15)] to-transparent animate-pulse" />
        <div className="absolute top-2/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-[hsl(217,45%,45%/0.1)] to-transparent animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-3/4 left-0 w-full h-px bg-gradient-to-r from-transparent via-[hsl(217,45%,45%/0.08)] to-transparent animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute left-1/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[hsl(217,45%,45%/0.08)] to-transparent animate-pulse" style={{ animationDelay: "0.5s" }} />
        <div className="absolute left-3/4 top-0 h-full w-px bg-gradient-to-b from-transparent via-[hsl(217,45%,45%/0.06)] to-transparent animate-pulse" style={{ animationDelay: "1.5s" }} />
      </div>

      {/* Subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[hsl(217,45%,45%/0.04)] blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-sm px-8">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-lg font-light tracking-[0.3em] text-white/90 uppercase">
            Painel Gerencial
          </h1>
          <p className="text-[11px] tracking-[0.2em] text-white/30 mt-1.5 uppercase">
            Acesso restrito
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] tracking-[0.15em] text-white/25 uppercase pl-1">
              E-mail
            </label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="bg-white/[0.03] border-white/[0.06] text-white/80 placeholder:text-white/15 focus-visible:ring-white/10 focus-visible:border-white/10 h-10 text-sm"
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] tracking-[0.15em] text-white/25 uppercase pl-1">
              Senha
            </label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="bg-white/[0.03] border-white/[0.06] text-white/80 placeholder:text-white/15 focus-visible:ring-white/10 focus-visible:border-white/10 h-10 text-sm"
              autoComplete="current-password"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full h-10 bg-white/[0.06] hover:bg-white/[0.1] text-white/70 hover:text-white/90 border border-white/[0.06] hover:border-white/[0.12] transition-all duration-500 text-xs tracking-[0.15em] uppercase font-light mt-2"
          >
            {loading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <LogIn className="w-3.5 h-3.5" />
                Entrar
              </>
            )}
          </Button>
        </form>

        {/* Footer note */}
        <p className="text-center text-[10px] text-white/15 mt-8 tracking-wide">
          Acesso exclusivo para gestores autorizados
        </p>
      </div>
    </div>
  );
}
