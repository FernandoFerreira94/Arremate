import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap", {
  variants: {
    variant: {
      live: "bg-live-soft text-live",
      scheduled: "bg-scheduled-soft text-scheduled",
      ended: "bg-ended-soft text-ended",
      success: "bg-success-soft text-success",
      warning: "bg-warning-soft text-warning border border-warning/30",
      danger: "bg-danger-soft text-danger",
      neutral: "bg-muted text-muted-foreground",
    },
  },
  defaultVariants: { variant: "neutral" },
});

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
