import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

const Dialog = DialogPrimitive.Root

const DialogTrigger = DialogPrimitive.Trigger

const DialogPortal = DialogPrimitive.Portal

const DialogClose = DialogPrimitive.Close

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: 'sm' | 'md' | 'lg' | 'xl'
  }
>(({ className, children, size = 'md', ...props }, ref) => {
  const sizeClasses = {
    sm: 'sm:max-w-md',
    md: 'sm:max-w-lg',
    lg: 'sm:max-w-2xl',
    xl: 'sm:max-w-4xl',
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          /* Mobile: bottom sheet / full-screen */
          "fixed inset-x-0 bottom-0 z-50 w-full",
          "rounded-t-xl border-t border-default bg-surface-0 p-0 shadow-modal",
          "max-h-[92vh] flex flex-col",
          /* Desktop: centered modal */
          "sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
          "sm:rounded-xl sm:border sm:border-default sm:max-h-[85vh]",
          /* Animations */
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          /* Mobile: slide up from bottom */
          "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
          /* Desktop: fade + zoom */
          "sm:data-[state=closed]:fade-out-0 sm:data-[state=open]:fade-in-0",
          "sm:data-[state=closed]:zoom-out-[0.98] sm:data-[state=open]:zoom-in-[0.98]",
          "sm:data-[state=closed]:slide-out-to-bottom-0 sm:data-[state=open]:slide-in-from-bottom-0",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {/* Mobile drag handle indicator */}
        <div className="mx-auto mt-2 h-1 w-8 rounded-full bg-surface-300 sm:hidden" />
        {children}
        <DialogPrimitive.Close className="absolute right-3 top-3 rounded-md p-2 text-surface-400 hover:bg-surface-100 hover:text-surface-600 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center">
          <X className="h-4 w-4" />
          <span className="sr-only">Fechar</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  )
})
DialogContent.displayName = DialogPrimitive.Content.displayName

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("border-b border-subtle px-5 py-4 max-sm:px-4 max-sm:py-3", className)}
    {...props}
  />
)
DialogHeader.displayName = "DialogHeader"

const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex items-center justify-end gap-2 border-t border-subtle px-5 py-3",
      "max-sm:flex-col-reverse max-sm:px-4 max-sm:py-4 max-sm:gap-2.5",
      className
    )}
    {...props}
  />
)
DialogFooter.displayName = "DialogFooter"

const DialogBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("px-5 py-4 overflow-y-auto flex-1 max-sm:px-4", className)}
    {...props}
  />
)
DialogBody.displayName = "DialogBody"

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-[15px] font-semibold text-surface-900 tracking-tight", className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("mt-0.5 text-[13px] text-surface-500", className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogBody,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
