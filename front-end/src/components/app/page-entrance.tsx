"use client";

import { usePathname } from "next/navigation";

export function PageEntrance({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <div key={pathname} className="page-entrance" data-page-path={pathname} onFocusCapture={(event) => { event.currentTarget.dataset.entryInterrupted = "true"; }}>{children}</div>;
}
