import { useState, useEffect } from "react";
import { API_URL } from "@/lib/api";
import type { Session } from "@supabase/supabase-js";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Temporariamente pulando/ocultando a tela de login (sempre ativa a sessão):
    setSession({ user: { id: '1' } } as any);
    setLoading(false);
  }, []);

  const signOut = async () => {
    localStorage.removeItem('token');
  };

  return { session, loading, signOut };
}
