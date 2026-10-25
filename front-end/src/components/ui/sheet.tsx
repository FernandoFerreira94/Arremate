"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Sheet = SheetPrimitive.Root;
const SheetTrigger = SheetPrimitive.Trigger;
const SheetClose = SheetPrimitive.Close;

function SheetContent({
  className,
  side = "right",
  children,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & { side?: "right" | "bottom" }) {
  return (
    <SheetPrimitive.Portal>
      <SheetPrimitive.Overlay className="sheet-overlay fixed inset-0 z-40 bg-foreground/40" />
      <SheetPrimitive.Content
        className={cn(
          "sheet-content fixed z-50 flex flex-col gap-4 bg-card p-6 shadow-lg",
          side === "right" ? "inset-y-0 right-0 w-4/5 max-w-sm border-l" : "inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-xl border-t",
          className,
        )}
        data-side={side}
        {...props}
      >
        {children}
        <SheetPrimitive.Close className="absolute right-4 top-4 inline-flex size-11 items-center justify-center rounded-md hover:bg-muted">
          <XIcon className="size-5" />
          <span className="sr-only">Fechar</span>
        </SheetPrimitive.Close>
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}
function SheetTitle({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return <SheetPrimitive.Title className={cn("font-serif text-lg font-semibold", className)} {...props} />;
}
function SheetDescription({ className, ...props }: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return <SheetPrimitive.Description className={cn("text-sm text-muted-foreground", className)} {...props} />;
}

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetTitle, SheetDescription };
