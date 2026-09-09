import { Wrench } from "lucide-react";

export default function Manutencao() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6"
      style={{ backgroundColor: "#0284c5" }}
    >
      <Wrench className="w-16 h-16 text-white/80 mb-6" strokeWidth={1.5} />
      <h1 className="text-2xl sm:text-3xl font-light text-white tracking-wide mb-3">
        Painel Gerencial UMB
      </h1>
      <p className="text-white/70 text-sm sm:text-base font-light tracking-wide text-center max-w-md">
        Estamos em manutenção. Voltaremos em breve.
      </p>
    </div>
  );
}
