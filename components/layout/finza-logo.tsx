import { cn } from "@/lib/utils";

interface Props {
  size?: "sm" | "md" | "lg";
  className?: string;
  withSlogan?: boolean;
}

const textSizes = {
  sm: "text-xl",
  md: "text-2xl",
  lg: "text-3xl",
};

/**
 * Logo de finems: wordmark tipográfico igual al de la imagen.
 * Color verde oscuro sobre fondo crema (hereda el fondo del padre).
 */
export function FinzaLogo({ size = "md", className, withSlogan = false }: Props) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span
        className={cn(
          "font-bold tracking-tight lowercase leading-none",
          "text-[#2d5016]",   // verde oscuro del logo
          textSizes[size]
        )}
      >
        finems
      </span>
      {withSlogan && (
        <span className="text-[11px] text-muted-foreground tracking-wide mt-0.5">
          Tus finanzas en un solo lugar
        </span>
      )}
    </div>
  );
}
