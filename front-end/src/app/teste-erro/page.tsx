import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/** Só no E2E (NEXT_PUBLIC_E2E_ERRORS=1): força o error.tsx para testar e fotografar a tela de erro. Fora disso, 404. */
export default function TesteErro() {
  if (process.env.NEXT_PUBLIC_E2E_ERRORS !== "1") notFound();
  throw new Error("Erro simulado para o E2E da tela de erro.");
}
