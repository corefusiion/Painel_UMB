import { useQuery } from "@tanstack/react-query";
import { SANEAIA_API_URL } from "@/lib/api";

export interface DnaEvent {
  type: string;
  description: string;
  probable_cause: string;
  location: string;
}

export interface DnaHidraulicoData {
  count: number;
  events: DnaEvent[];
}

export function useDnaHidraulico() {
  const { data, isLoading, error } = useQuery<DnaHidraulicoData>({
    queryKey: ["dna_hidraulico_events"],
    queryFn: async () => {
      const res = await fetch(`${SANEAIA_API_URL}/ml/events`);
      if (!res.ok) throw new Error("Falha ao buscar eventos DNA Hidráulico");
      return res.json();
    },
    refetchInterval: 30000,
    retry: 2,
  });

  const events = data?.events ?? [];
  const count = data?.count ?? 0;

  const masterEvents = events.filter((e) => e.type === "MASTER_EVENT");
  const diagnosticEvents = events.filter((e) => e.type === "ISOLATED_DIAGNOSTIC");

  return {
    events,
    count,
    masterEvents,
    diagnosticEvents,
    isLoading,
    error,
  };
}
