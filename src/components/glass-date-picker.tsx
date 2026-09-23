import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ar } from "date-fns/locale";
import { CalendarDays } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // yyyy-MM-dd
  onChange: (value: string) => void;
  minDate?: string | undefined;
  placeholder?: string;
  ariaLabel: string;
};

export function GlassDatePicker({ value, onChange, minDate, placeholder = "اختر التاريخ", ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;
  const min = minDate ? parseISO(minDate) : undefined;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={ariaLabel}
          className={cn(
            "group relative h-14 w-full justify-start overflow-hidden rounded-lg border border-primary/15 bg-card/75 px-4 text-right font-normal shadow-card backdrop-blur-xl transition-all hover:border-primary/30 hover:bg-card/90 focus-visible:ring-2 focus-visible:ring-primary/25",
            !selected && "text-muted-foreground",
          )}
        >
          <span className="pointer-events-none absolute inset-x-0 top-0 h-px bg-primary/20" aria-hidden />
          <span className="flex min-w-0 flex-1 items-center gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md border border-header-deep/15 bg-header-deep/5 shadow-sm transition-colors group-hover:bg-header-deep/10">
              <CalendarDays className="size-4 text-header-deep" aria-hidden />
            </span>
            <span dir="rtl" className={cn("min-w-0 flex-1 whitespace-nowrap text-sm leading-7", selected && "font-medium text-foreground")}>
              {selected ? format(selected, "d MMMM yyyy", { locale: ar }) : placeholder}
            </span>
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent
        dir="rtl"
        className="z-[80] w-[calc(100vw-1.5rem)] max-w-xs overflow-hidden rounded-xl border border-primary/15 bg-card/95 p-3 font-sans text-foreground shadow-card backdrop-blur-xl sm:max-w-xs"
      >
        <div className="pointer-events-none absolute inset-x-4 top-0 h-px bg-primary/25" aria-hidden />
        <DialogHeader className="px-2 pt-1 text-right sm:text-right">
          <DialogTitle className="font-kufi text-sm font-normal leading-8">{ariaLabel}</DialogTitle>
          <DialogDescription className="text-xs leading-6 text-muted-foreground">اختر اليوم المناسب من التقويم</DialogDescription>
        </DialogHeader>
        <Calendar
          mode="single"
          locale={ar}
          dir="rtl"
          showOutsideDays={false}
          formatters={{ formatWeekdayName: (date) => format(date, "EEEEE", { locale: ar }) }}
          {...(selected ? { selected } : {})}
          {...((selected ?? min) ? { defaultMonth: (selected ?? min) as Date } : {})}
          {...(min ? { disabled: { before: min } } : {})}
          onSelect={(date) => {
            if (!date) return;
            onChange(format(date, "yyyy-MM-dd"));
            setOpen(false);
          }}
          className="pointer-events-auto mx-auto w-full bg-transparent p-1 [--cell-size:2.25rem] [&_button]:text-inherit [&_button[data-selected-single=true]]:!rounded-full [&_button[data-selected-single=true]]:!bg-primary [&_button[data-selected-single=true]]:!text-primary-foreground [&_button[data-selected-single=true]]:shadow-md [&_button:hover]:bg-primary/10"
          classNames={{
            root: "w-full",
            month: "w-full gap-3",
            month_caption: "mx-12 flex h-11 items-center justify-center pt-1.5",
            caption_label: "font-kufi text-sm font-normal leading-7",
            nav: "absolute inset-x-0 top-0 flex h-11 items-center justify-between px-1",
            button_previous:
              "grid size-9 place-items-center rounded-full border border-header-deep/15 bg-header-deep/[0.05] text-header-deep shadow-sm backdrop-blur-md transition-colors hover:bg-header-deep/10 disabled:opacity-40",
            button_next:
              "grid size-9 place-items-center rounded-full border border-header-deep/15 bg-header-deep/[0.05] text-header-deep shadow-sm backdrop-blur-md transition-colors hover:bg-header-deep/10 disabled:opacity-40",
            chevron: "size-4 fill-header-deep",
            weekday: "p-0 text-center",
            week: "mt-1 flex w-full",
            disabled: "opacity-20",
            today: "rounded-full bg-header-deep/5 text-header-deep",
          }}
          components={{
            Weekday: ({ className, children, ...props }) => (
              <th {...props} className={cn("p-0 text-center", className)}>
                <span className="mx-auto grid size-7 place-items-center rounded-full border border-header-deep/15 bg-header-deep/[0.05] font-sans text-[11px] font-medium text-header-deep shadow-sm backdrop-blur-md">
                  {children}
                </span>
              </th>
            ),
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
