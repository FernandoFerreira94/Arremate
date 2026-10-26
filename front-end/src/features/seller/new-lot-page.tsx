"use client";

import { ArtworkImage } from "@/components/app/artwork-image";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertCircleIcon, CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, GavelIcon, InfoIcon, SearchIcon } from "lucide-react";
import { MoneyInput } from "@/components/app/money-input";
import { EmptyState, ErrorState, LoadingRows } from "@/components/app/page-states";
import { PageShell } from "@/components/app/page-shell";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api-error";
import { brtInputToUtcIso, formatBrt } from "@/lib/datetime";
import { createIdempotentAction } from "@/lib/idempotent-action";
import { formatBrl, parseBrlInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { buildPublishBody, type PublishErrors, type PublishForm } from "./publish-form";
import { publishLot, searchCatalog, type CatalogItem, type LotView } from "./seller-api";
import { messageOf, notifyError, notifySuccess } from "@/lib/notify";

const REASON: Record<string, string> = { LICENCA_RECUSADA: "Sem licença de domínio público", SEM_IMAGEM: "Sem imagem disponível" };
const PUBLISH_ERRORS: Record<string, string> = {
  AUDITORIA_INDISPONIVEL: "A auditoria está indisponível agora; o lote não foi publicado. Tente de novo mais tarde.",
  PROVEDOR_INDISPONIVEL: "O The Met não respondeu; o lote não foi publicado. Tente de novo.",
  LICENCA_RECUSADA: "Esta obra não tem licença de domínio público verificada.",
  IMAGEM_INVALIDA: "A imagem desta obra não pôde ser verificada.",
  DATAS_INVALIDAS: "Confira as datas: o início não pode estar no passado e o fim precisa ser depois do início.",
  VALOR_INVALIDO: "Confira os valores do lance inicial e do incremento.",
};

export function NewLotPage() {
  const client = useQueryClient();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<{ q: string; page: number } | null>(null);
  const [selected, setSelected] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<PublishForm>({ initial: "", increment: "", startsAt: "", endsAt: "" });
  const [errors, setErrors] = useState<PublishErrors>({});
  const [published, setPublished] = useState<LotView | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const results = useQuery({
    queryKey: ["seller", "catalog", search?.q, search?.page],
    queryFn: () => searchCatalog(search?.q ?? "", search?.page ?? 1),
    enabled: search !== null,
  });
  const action = useMemo(() => createIdempotentAction((body, key) => publishLot(JSON.parse(body), key)), []);
  const publish = useMutation({
    mutationFn: (body: string) => action.run(body),
    onSuccess: (lot) => {
      setPublished(lot);
      notifySuccess(messageOf(lot, "Lote publicado."));
      void client.invalidateQueries({ queryKey: ["seller"] });
    },
    onError: (error) => {
      const code = error instanceof ApiError ? error.code : "";
      notifyError(error, "Não foi possível publicar o lote.");
      setPublishError(PUBLISH_ERRORS[code] ?? (error instanceof ApiError && error.statusCode !== 0 ? error.message : "Não confirmamos a publicação. Tente de novo: o mesmo pedido não cria lote duplicado."));
    },
  });
  const step = !selected ? 1 : !form.initial || !form.increment || !form.startsAt || !form.endsAt ? 3 : 4;

  function onSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearch({ q, page: 1 });
  }

  function onPublish(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublishError(null);
    const result = buildPublishBody(form, selected);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    publish.mutate(JSON.stringify(result.body));
  }

  if (published) {
    return (
      <PageShell title="Lote publicado">
        <Card className="max-w-xl">
          <CardContent className="flex flex-col gap-4">
            <Alert variant="success"><CheckCircle2Icon /><p>“{published.title}” foi publicado. Abre em {formatBrt(published.startsAt)} e termina em {formatBrt(published.endsAt)} (BRT).</p></Alert>
            <div className="flex flex-wrap gap-2">
              <Button asChild><Link href="/painel/lotes">Ver meus lotes</Link></Button>
              <Button asChild variant="outline"><Link href={`/lotes/${published.id}`}>Abrir sala</Link></Button>
            </div>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const set = (key: keyof PublishForm) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  return (
    <PageShell title="Criar lote" description="Buscar obra → selecionar → configurar → revisar e publicar.">
      <ol className="mb-6 flex flex-wrap items-center gap-2 text-sm" aria-label="Etapas">
        {["Buscar obra", "Selecionar", "Configurar", "Revisar e publicar"].map((label, index) => (
          <li key={label} className="flex items-center gap-2" aria-current={step === index + 1 ? "step" : undefined}>
            <span className={cn("grid size-6 place-items-center rounded-full text-xs font-semibold", index + 1 <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground")}>{index + 1}</span>
            <span className={cn(index + 1 === step && "font-medium")}>{label}</span>
            {index < 3 ? <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden /> : null}
          </li>
        ))}
      </ol>
      <form onSubmit={onPublish} noValidate className="grid gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <Card>
            <CardHeader><CardTitle>1–2 · Buscar e selecionar obra (The Met)</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div role="search" className="flex gap-2">
                <Label htmlFor="catalog-q" className="sr-only">Buscar obra</Label>
                <div className="relative flex-1">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
                  <Input id="catalog-q" className="pl-9" placeholder="Ex.: andes, van gogh, hokusai" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      onSearch();
                    }
                  }} />
                </div>
                <Button type="button" onClick={onSearch}>Buscar</Button>
              </div>
              <p className="text-xs text-muted-foreground">Só obras de domínio público com imagem. Sem upload ou URL própria.{results.data ? ` ${results.data.total} resultados.` : ""}</p>
              {errors.item ? <p className="text-xs font-medium text-danger" role="alert">{errors.item}</p> : null}
              {search === null ? null : results.isPending ? (
                <LoadingRows label="Buscando obras" rows={2} />
              ) : results.isError ? (
                <ErrorState message="O catálogo do The Met não respondeu. Tente de novo em instantes." onRetry={() => void results.refetch()} />
              ) : results.data.items.length === 0 ? (
                <EmptyState title="Nenhuma obra encontrada" description="Tente outro termo, como o nome do artista ou da obra." />
              ) : (
                <>
                  <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {results.data.items.map((item) => {
                      const isSelected = selected?.externalId === item.externalId;
                      return (
                        <li key={item.externalId} className={cn("flex flex-col overflow-hidden rounded-lg border bg-card", isSelected && "border-primary ring-1 ring-primary")}>
                          {item.thumbnailUrl ? (

                            <ArtworkImage src={item.thumbnailUrl} alt="" width={800} height={600} sizes="(min-width: 768px) 15vw, 50vw" className="aspect-[4/3] h-auto w-full object-cover" referrerPolicy="no-referrer" />
                          ) : (
                            <div className="grid aspect-[4/3] place-items-center bg-muted text-xs text-muted-foreground">Imagem indisponível</div>
                          )}
                          <div className="flex flex-1 flex-col gap-1 p-3">
                            <p className="line-clamp-2 font-serif text-sm font-semibold">{item.title}</p>
                            <p className="line-clamp-1 text-xs text-muted-foreground">{item.artist || "Artista desconhecido"} · {item.date}</p>
                            <div className="mt-auto pt-2">
                              {item.importable ? (
                                <Button type="button" size="sm" variant={isSelected ? "default" : "outline"} className="w-full" aria-pressed={isSelected} onClick={() => setSelected(item)}>
                                  {isSelected ? <><CheckCircle2Icon /> Selecionada</> : "Selecionar"}
                                </Button>
                              ) : (
                                <Badge variant="neutral">{REASON[item.reason ?? ""] ?? "Obra não apta"}</Badge>
                              )}
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex justify-center gap-2">
                    <Button type="button" variant="outline" size="sm" disabled={(search?.page ?? 1) <= 1} onClick={() => setSearch((s) => (s ? { ...s, page: s.page - 1 } : s))}><ChevronLeftIcon /> Anterior</Button>
                    <Button type="button" variant="outline" size="sm" disabled={!results.data.hasMore} onClick={() => setSearch((s) => (s ? { ...s, page: s.page + 1 } : s))}>Próxima <ChevronRightIcon /></Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>3 · Configurar leilão</CardTitle></CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="initial">Lance inicial (R$)</Label>
                <MoneyInput id="initial" value={form.initial} onChange={set("initial")} error={errors.initial} hint="Ex.: 30.000,00" disabled={publish.isPending} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="increment">Incremento mínimo (R$)</Label>
                <MoneyInput id="increment" value={form.increment} onChange={set("increment")} error={errors.increment} hint="Ex.: 1.000,00" disabled={publish.isPending} />
              </div>
              <DateField id="startsAt" label="Início" value={form.startsAt} onChange={set("startsAt")} error={errors.startsAt} hint="Horário de Brasília (UTC−3)" disabled={publish.isPending} />
              <DateField id="endsAt" label="Fim" value={form.endsAt} onChange={set("endsAt")} error={errors.endsAt} hint="Lance nos últimos 2 min renova o fim para +2 min" disabled={publish.isPending} />
            </CardContent>
          </Card>
        </div>
        <div className="flex flex-col gap-6 lg:col-span-5">
          {selected ? (
            <Card className="overflow-hidden">
              {selected.thumbnailUrl ? (

                <ArtworkImage src={selected.thumbnailUrl} alt={selected.title} width={800} height={500} sizes="(min-width: 1024px) 42vw, 100vw" className="aspect-[16/10] h-auto w-full object-cover" referrerPolicy="no-referrer" />
              ) : null}
              <CardContent className="flex flex-col gap-1">
                <Badge variant="warning" className="self-start">Obra selecionada</Badge>
                <p className="font-serif text-xl font-semibold">{selected.title}</p>
                <p className="text-sm text-muted-foreground">{selected.artist} · {selected.date} · {selected.medium}</p>
                <p className="text-xs text-muted-foreground">The Met · obj. {selected.externalId} · CC0 (verificado no servidor ao publicar)</p>
              </CardContent>
            </Card>
          ) : (
            <EmptyState title="Nenhuma obra selecionada" description="Busque e selecione uma obra para ver a prévia aqui." />
          )}
          <Card>
            <CardHeader><CardTitle>4 · Revisar e publicar</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <dl className="flex flex-col text-sm">
                <ReviewRow label="Lance inicial" value={reviewMoney(form.initial)} />
                <ReviewRow label="Incremento" value={reviewMoney(form.increment)} />
                <ReviewRow label="Início" value={reviewDate(form.startsAt)} />
                <ReviewRow label="Fim" value={reviewDate(form.endsAt)} />
              </dl>
              <Alert variant="warning"><InfoIcon /><p>Simulação: a obra original pertence ao The Met e não está à venda.</p></Alert>
              {publishError ? <Alert variant="destructive"><AlertCircleIcon /><p>{publishError}</p></Alert> : null}
              <Button type="submit" size="lg" disabled={publish.isPending}>
                <GavelIcon /> {publish.isPending ? "Publicando…" : "Publicar lote"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </form>
    </PageShell>
  );
}

function reviewMoney(text: string): string {
  if (!text.trim()) return "—";
  const parsed = parseBrlInput(text);
  return parsed.ok ? formatBrl(parsed.cents) : "Valor inválido";
}

function reviewDate(local: string): string {
  const iso = brtInputToUtcIso(local);
  return iso ? `${formatBrt(iso)} BRT` : "—";
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between border-b py-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function DateField({ id, label, value, onChange, error, hint, disabled }: { id: string; label: string; value: string; onChange: (value: string) => void; error?: string; hint: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} aria-invalid={error ? true : undefined} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ""}`} disabled={disabled} />
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p>
      {error ? <p id={`${id}-error`} className="text-xs font-medium text-danger">{error}</p> : null}
    </div>
  );
}
