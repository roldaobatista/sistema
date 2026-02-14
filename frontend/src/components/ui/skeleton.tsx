import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-md bg-surface-100 animate-shimmer",
        "bg-[length:200%_100%]",
        "bg-gradient-to-r from-surface-100 via-surface-200 to-surface-100",
        className
      )}
      {...props}
    />
  )
}

export { Skeleton }
