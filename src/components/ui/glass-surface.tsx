import * as React from "react";
import { cn } from "@/lib/utils";

export function GlassSurface({ className, ...props }: React.ComponentProps<"div">) {
  return <div className={cn("app-glass", className)} {...props} />;
}