import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Manutencao from "./pages/Manutencao";
import Login from "./pages/Login";
import { useAuth } from "./hooks/useAuth";

// 🔧 Para ativar/desativar modo manutenção, troque para true/false:
const MAINTENANCE_MODE = false;

const queryClient = new QueryClient();

function AppRoutes() {
  const { session, loading } = useAuth();

  if (MAINTENANCE_MODE) {
    return (
      <Routes>
        <Route path="*" element={<Manutencao />} />
      </Routes>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(234,50%,8%)]">
        <div className="w-5 h-5 border border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
