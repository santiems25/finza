import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
  withWordmark?: boolean;
}

export function FinzaLogo({ size = "md", className, withWordmark = true }: Props) {
  const iconSizes = { sm: "h-6 w-6", md: "h-8 w-8", lg: "h-10 w-10" };
  const textSizes = { sm: "text-lg", md: "text-2xl", lg: "text-3xl" };

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {/* Ícono: ₣ estilizado con gradiente */}
      <div
        className={cn(
          "rounded-xl flex items-center justify-center shrink-0 font-black",
          iconSizes[size],
          "bg-gradient-to-br from-blue-500 to-violet-600 text-white"
        )}
        style={{ fontSize: size === "sm" ? 14 : size === "md" ? 18 : 22 }}
      >
        ₣
      </div>
      {withWordmark && (
        <span
          className={cn(
            "font-bold tracking-tight bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent",
            textSizes[size]
          )}
        >
          Finza
        </span>
      )}
    </div>
  );
}
