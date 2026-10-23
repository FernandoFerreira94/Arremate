import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="inline-flex min-h-11 items-center gap-2.5" aria-label="Arremate, página inicial">
      <span aria-hidden className="grid size-8 place-items-center rounded-md bg-primary p-[3px]">
        <span className="grid size-full place-items-center rounded-[3px] border border-accent font-serif text-lg font-bold leading-none text-primary-foreground">A</span>
      </span>
      <span className="font-serif text-xl font-semibold">Arremate</span>
    </Link>
  );
}
