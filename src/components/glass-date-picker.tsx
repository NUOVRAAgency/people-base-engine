import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  minDate?: string;
  placeholder?: string;
  ariaLabel: string;
};

export function GlassDatePicker({ value, onChange, minDate, placeholder = "اختر التاريخ", ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  const min = minDate ? parseISO(minDate) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            "flex h-11 w-full items-center justify-between gap-2 rounded-md border border-foreground/10 bg-foreground/[0.03] px-3 text-sm shadow-sm backdrop-blur-md transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="truncate">{selected ? format(selected, "d MMM yyyy", { locale: ar }) : placeholder}</span>
          <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        dir="rtl"
        className="z-[60] w-auto rounded-xl border border-foreground/10 bg-foreground/80 p-2 text-background shadow-card backdrop-blur-xl"
      >
        <Calendar
          mode="single"
          locale={ar}
          dir="rtl"
          selected={selected}
          defaultMonth={selected ?? min}
          disabled={min ? { before: min } : undefined}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          className="pointer-events-auto p-2 text-background [&_button]:text-inherit [&_button[data-selected-single=true]]:!rounded-full [&_button[data-selected-single=true]]:!bg-primary [&_button[data-selected-single=true]]:!text-primary-foreground [&_button:hover]:bg-background/10"
          classNames={{ disabled: "opacity-25" }}
        />
      </PopoverContent>
    </Popover>
  );
}
