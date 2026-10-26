"use client";

import { useState } from "react";
import { LifeBuoyIcon, SearchIcon } from "lucide-react";
import { EmptyState } from "@/components/app/page-states";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FAQ_CATEGORIES, FAQ_ITEMS, filterFaq, type FaqCategory } from "./faq-data";

/** R9: Suporte/FAQ com busca, filtros e Accordion. */
export function FaqPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FaqCategory | "todas">("todas");
  const items = filterFaq(FAQ_ITEMS, query, category);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2 text-4xl"><LifeBuoyIcon className="size-8 text-primary" aria-hidden /> Suporte</h1>
        <p className="mt-2 text-muted-foreground">Perguntas frequentes sobre lances, carteira simulada, conta e auditoria.</p>
      </div>
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input type="search" aria-label="Buscar nas perguntas" placeholder="Buscar: lance mínimo, prorrogação, saldo…" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      <Tabs value={category} onValueChange={(value) => setCategory(value as FaqCategory | "todas")} className="min-w-0">
        <TabsList aria-label="Categorias" className="h-auto w-full flex-wrap justify-start sm:w-auto">
          {FAQ_CATEGORIES.map((c) => <TabsTrigger key={c.value} value={c.value}>{c.label}</TabsTrigger>)}
        </TabsList>
      </Tabs>
      {items.length === 0 ? (
        <EmptyState
          title="Nenhuma pergunta encontrada"
          description="Tente outra palavra ou veja todas as categorias."
          action={<Button variant="outline" onClick={() => { setQuery(""); setCategory("todas"); }}>Limpar busca</Button>}
        />
      ) : (
        <Card>
          <CardContent className="py-2">
            <Accordion type="single" collapsible>
              {items.map((item) => (
                <AccordionItem key={item.id} value={item.id} id={item.id}>
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      )}
      <p className="text-sm text-muted-foreground">Não achou? Esta é uma demonstração técnica e não há atendimento humano; as respostas acima cobrem o que o site faz.</p>
    </div>
  );
}
