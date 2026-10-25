"use client";

import * as React from "react";
import { NavigationMenu as NavigationMenuPrimitive } from "radix-ui";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";

function NavigationMenu({ className, children, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Root>) {
  return (
    <NavigationMenuPrimitive.Root className={cn("relative flex items-center justify-center", className)} {...props}>
      {children}
    </NavigationMenuPrimitive.Root>
  );
}
function NavigationMenuList({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.List>) {
  return <NavigationMenuPrimitive.List className={cn("flex items-center gap-1", className)} {...props} />;
}
const NavigationMenuItem = NavigationMenuPrimitive.Item;
const navItemClass = "inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm hover:bg-muted data-[state=open]:bg-muted [&_svg]:size-4";
function NavigationMenuTrigger({ className, children, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Trigger>) {
  return (
    <NavigationMenuPrimitive.Trigger className={cn(navItemClass, "group", className)} {...props}>
      {children}
      <ChevronDownIcon className="transition-transform group-data-[state=open]:rotate-180" aria-hidden />
    </NavigationMenuPrimitive.Trigger>
  );
}
function NavigationMenuContent({ className, ...props }: React.ComponentProps<typeof NavigationMenuPrimitive.Content>) {
  return (
    <NavigationMenuPrimitive.Content
      className={cn("absolute left-1/2 top-full z-50 mt-2 w-[30rem] -translate-x-1/2 rounded-lg border bg-card p-3 shadow-lg", className)}
      {...props}
    />
  );
}
const NavigationMenuLink = NavigationMenuPrimitive.Link;

export { NavigationMenu, NavigationMenuList, NavigationMenuItem, NavigationMenuTrigger, NavigationMenuContent, NavigationMenuLink, navItemClass };
