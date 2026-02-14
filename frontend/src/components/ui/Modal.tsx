import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

interface ModalProps {
    open?: boolean
    isOpen?: boolean
    onOpenChange?: (open: boolean) => void
    onClose?: () => void
    title: string
    description?: string
    children: React.ReactNode
    footer?: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({
    open,
    isOpen,
    onOpenChange,
    onClose,
    title,
    description,
    children,
    footer,
    size = 'md',
}: ModalProps) {
    const resolvedOpen = open ?? isOpen ?? false
    const handleOpenChange = (nextOpen: boolean) => {
        onOpenChange?.(nextOpen)
        if (!nextOpen) {
            onClose?.()
        }
    }

    return (
        <Dialog open={resolvedOpen} onOpenChange={handleOpenChange}>
            <DialogContent size={size}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                <DialogBody>
                    {children}
                    {footer && (
                        <div className="mt-5 border-t border-default pt-4">
                            {footer}
                        </div>
                    )}
                </DialogBody>
            </DialogContent>
        </Dialog>
    )
}
