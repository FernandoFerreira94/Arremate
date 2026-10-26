"use client";

import { BellIcon, BellOffIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { formatBrt } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { badgeLabel, notificationLabel, type NotificationItem } from "./notifications-api";
import { useMarkRead, useNotifications } from "./use-notifications";

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)");
    const update = () => setDesktop(media.matches);
    const id = requestAnimationFrame(update);
    media.addEventListener("change", update);
    return () => {
      cancelAnimationFrame(id);
      media.removeEventListener("change", update);
    };
  }, []);
  return desktop;
}

/** N2-atual: sino no header atual, à esquerda do saldo (36 px desktop, 44 px mobile). N3: Popover no desktop, Sheet no mobile. */
export function NotificationBell() {
  const desktop = useIsDesktop();
  const [open, setOpen] = useState(false);
  const query = useNotifications();
  const unread = query.data?.unread ?? 0;
  const badge = badgeLabel(unread);
  const trigger = (
    <Button variant="ghost" size="icon" className="relative size-11 md:size-9" aria-label={unread > 0 ? `Notificações, ${unread} não lidas` : "Notificações"}>
      <BellIcon />
      {badge ? (
        <span aria-hidden className="absolute top-0.5 right-0.5 inline-flex min-w-[18px] items-center justify-center rounded-full bg-primary px-1 text-[11px] font-semibold leading-[18px] text-primary-foreground">
          {badge}
        </span>
      ) : null}
    </Button>
  );
  const panel = <NotificationPanel items={query.data?.items ?? []} unread={unread} onNavigate={() => setOpen(false)} />;
  if (desktop) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
        <PopoverContent aria-label="Notificações">{panel}</PopoverContent>
      </Popover>
    );
  }
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>{trigger}</SheetTrigger>
      <SheetContent className="w-full max-w-none p-0 sm:max-w-sm">
        <SheetTitle className="sr-only">Notificações</SheetTitle>
        <SheetDescription className="sr-only">Avisos dos lotes que você acompanha.</SheetDescription>
        {panel}
      </SheetContent>
    </Sheet>
  );
}

function NotificationPanel({ items, unread, onNavigate }: { items: NotificationItem[]; unread: number; onNavigate: () => void }) {
  const markRead = useMarkRead();
  return (
    <div className="flex max-h-[min(70vh,520px)] flex-col">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <p className="font-serif text-lg font-semibold">Notificações</p>
        <Button variant="link" size="sm" className="h-auto min-h-11 px-0 md:min-h-0" disabled={unread === 0 || markRead.isPending} onClick={() => markRead.mutate(null)}>
          Marcar todas como lidas
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
          <BellOffIcon className="size-8 text-muted-foreground" />
          <p className="font-medium">Nenhuma notificação</p>
          <p className="text-sm text-muted-foreground">Use &apos;Avise-me quando abrir&apos; em um lote agendado para ser avisado aqui.</p>
        </div>
      ) : (
        <ul className="overflow-y-auto">
          {items.map((item) => (
            <li key={item.id} className="border-b last:border-b-0">
              <Link
                href={`/lotes/${item.lotId}`}
                onClick={() => {
                  if (item.readAt === null) markRead.mutate(item.id);
                  onNavigate();
                }}
                className={cn("flex min-h-11 gap-3 px-4 py-3 hover:bg-muted", item.readAt === null && "bg-accent/15")}
              >
                <span aria-hidden className={cn("mt-2 size-2 shrink-0 rounded-full", item.readAt === null ? "bg-primary" : "bg-transparent")} />
                {/* eslint-disable-next-line @next/next/no-img-element -- mídia local já validada pela API */}
                <img src={item.imageUrl} alt="" className="size-12 shrink-0 rounded-md bg-muted object-cover" />
                <span className="min-w-0">
                  <span className="block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {notificationLabel(item.kind)}{item.readAt === null ? <span className="sr-only"> (não lida)</span> : null}
                  </span>
                  <span className="block truncate text-sm font-medium">{item.title}</span>
                  <span className="block text-xs text-muted-foreground">{formatBrt(item.createdAt)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
