import Image from "next/image";
import Link from "next/link";

/** Logo L3 (martelo, docs/design/pranchas/logo): versão horizontal com o nome em curvas; no tema escuro, nome em papel. */
export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center" aria-label="Arremate, página inicial">
      <Image src="/brand/l3-horizontal-paper.svg" alt="" width={135} height={32} priority className="h-8 w-auto dark:hidden" />
      <Image src="/brand/l3-horizontal-noite.svg" alt="" width={135} height={32} priority className="hidden h-8 w-auto dark:block" />
    </Link>
  );
}
