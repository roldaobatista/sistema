import { toast as sonnerToast } from "sonner"

type ToasterToast = {
    title?: string
    description?: string
    variant?: "default" | "destructive"
    className?: string
}

export function useToast() {
    const toast = ({ title, description, variant, className }: ToasterToast) => {
        const options = {
            description,
            className,
        }

        if (variant === "destructive") {
            return sonnerToast.error(title || description, options)
        }

        return sonnerToast(title || description, options)
    }

    return {
        toast,
        dismiss: (id?: string) => { }, // Shim
    }
}
