import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'

interface ModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    title: string
    description?: string
    children: React.ReactNode
    size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function Modal({ open, onOpenChange, title, description, children, size = 'md' }: ModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent size={size}>
                <DialogHeader>
                    <DialogTitle>{title}</DialogTitle>
                    {description && (
                        <DialogDescription>{description}</DialogDescription>
                    )}
                </DialogHeader>
                <DialogBody>
                    {children}
                </DialogBody>
            </DialogContent>
        </Dialog>
    )
}
