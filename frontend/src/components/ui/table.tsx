import * as React from "react"
import { cn } from "@/lib/utils"

function useHasScroll(ref: React.RefObject<HTMLDivElement | null>) {
  const [hasScroll, setHasScroll] = React.useState(false)

  React.useEffect(() => {
    const el = ref.current
    if (!el) return

    const check = () => {
      setHasScroll(el.scrollWidth > el.clientWidth)
    }

    check()
    const observer = new ResizeObserver(check)
    observer.observe(el)

    return () => observer.disconnect()
  }, [ref])

  return hasScroll
}

const Table = React.forwardRef<
  HTMLTableElement,
  React.HTMLAttributes<HTMLTableElement>
>(({ className, ...props }, ref) => {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const hasScroll = useHasScroll(scrollRef)

  return (
    <div
      ref={scrollRef}
      className={cn("table-scroll-fade relative w-full overflow-auto", hasScroll && "table-scroll-container")}
      data-has-scroll={hasScroll}
    >
      <table
        ref={ref}
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
})
Table.displayName = "Table"

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b [&_tr]:border-surface-100 dark:[&_tr]:border-white/[0.06]", className)} {...props} />
))
TableHeader.displayName = "TableHeader"

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn("[&_tr:last-child]:border-0", className)}
    {...props}
  />
))
TableBody.displayName = "TableBody"

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      "border-t bg-surface-50/50 dark:bg-white/[0.02] font-medium [&>tr]:last:border-b-0",
      className
    )}
    {...props}
  />
))
TableFooter.displayName = "TableFooter"

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      "border-b border-surface-100 dark:border-white/[0.04] transition-colors",
      "hover:bg-surface-50/80 dark:hover:bg-white/[0.02] data-[state=selected]:bg-brand-50/50 dark:data-[state=selected]:bg-brand-500/[0.06]",
      className
    )}
    {...props}
  />
))
TableRow.displayName = "TableRow"

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-11 px-4 text-left align-middle text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-400",
      "bg-surface-50/60 dark:bg-white/[0.02]",
      "max-sm:px-2.5 max-sm:h-10 max-sm:text-[10px]",
      "[&:has([role=checkbox])]:pr-0",
      className
    )}
    {...props}
  />
))
TableHead.displayName = "TableHead"

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      "px-4 py-3.5 align-middle [&:has([role=checkbox])]:pr-0",
      "max-sm:px-2.5 max-sm:py-2.5 max-sm:text-xs",
      className
    )}
    {...props}
  />
))
TableCell.displayName = "TableCell"

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn("mt-4 text-sm text-surface-500", className)}
    {...props}
  />
))
TableCaption.displayName = "TableCaption"

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}
