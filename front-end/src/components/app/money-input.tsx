"use client";

import { Input } from "@/components/ui/input";
import { formatBrl, parseBrlInput } from "@/lib/money";

/** Campo monetário com prefixo R$ e o valor entendido (Postel). */
export function MoneyInput({
  id,
  value,
  onChange,
  error,
  hint,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const parsed = value.trim() ? parseBrlInput(value) : null;
  const describedBy = `${id}-hint${error ? ` ${id}-error` : ""}`;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative">
        <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="pl-10 text-base font-semibold"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          disabled={disabled}
        />
      </div>
      <p id={`${id}-hint`} className="text-xs text-muted-foreground">
        {parsed?.ok ? `Valor entendido: ${formatBrl(parsed.cents)}` : hint}
      </p>
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
