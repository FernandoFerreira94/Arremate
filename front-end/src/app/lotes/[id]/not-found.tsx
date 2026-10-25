import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return <div className="mx-auto flex max-w-lg flex-col items-center gap-3 py-16 text-center"><h1 className="text-3xl">Lote não encontrado</h1><p className="text-sm text-muted-foreground">Confira o endereço ou volte à vitrine.</p><Button asChild variant="outline"><Link href="/">Ir para a vitrine</Link></Button></div>;
}
