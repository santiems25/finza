"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TrendingUp, Landmark, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";
import { QuickAddMovementButton } from "@/components/layout/quick-add-movement";

const leftItems = [
  { href: "/",       icon: LayoutDashboard, label: "Inicio" },
  { href: "/ahorro", icon: Landmark,        label: "Ahorro" },
];
const rightItems = [
  { href: "/inversiones",   icon: TrendingUp, label: "Portafolio" },
  { href: "/configuracion", icon: CreditCard, label: "Tarjetas"   },
];

export function BottomNav() {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/register") return null;

  const renderItem = ({ href, icon: Icon, label }: typeof leftItems[number]) => {
    const active = pathname === href;
    return (
      <Link
        key={href}
        href={href}
        className={cn(
          "flex flex-col items-center gap-0.5 flex-1 py-2 rounded-lg transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        )}
      >
        <Icon className={cn("h-5 w-5 transition-all", active && "scale-110")} />
        <span className="text-[9px] font-medium leading-none">{label}</span>
      </Link>
    );
  };

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 safe-bottom">
      <div className="flex items-center justify-around h-16 px-1">
        {leftItems.map(renderItem)}
        <div className="flex-1 flex items-center justify-center">
          <div className="-mt-7">
            <QuickAddMovementButton />
          </div>
        </div>
        {rightItems.map(renderItem)}
      </div>
    </nav>
  );
}
