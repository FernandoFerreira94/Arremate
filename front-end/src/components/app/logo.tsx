import Image from "next/image";
import Link from "next/link";

/** Logo L3 (martelo, docs/design/pranchas/logo): versão horizontal sobre papel, já com o nome em curvas. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Arremate, página inicial">
      <Image src="/brand/l3-horizontal-paper.svg" alt="" width={135} height={32} priority className="h-8 w-auto" />
    </Link>
  );
}
