import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Vitrine definitiva entra na Tarefa 9. Aqui só a entrada da demonstração. */
export default function HomePage() {
  return (
    <div className="flex max-w-2xl flex-col gap-4">
      <h1 className="text-4xl">Arremate</h1>
      <p className="text-muted-foreground">Leilões simulados de obras de acervo público. A vitrine e a sala ao vivo entram na próxima etapa.</p>
      <div>
        <Button asChild size="lg"><Link href="/entrar">Entrar</Link></Button>
      </div>
    </div>
  );
}
