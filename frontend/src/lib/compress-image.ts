const MAX_WIDTH = 1200
const QUALITY = 0.7

/**
 * Compresses an image file using canvas before upload.
 * Resizes to max 1200px width and outputs JPEG at 0.7 quality.
 */
export function compressImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            resolve(file)
            return
        }

        const reader = new FileReader()
        reader.onerror = () => reject(new Error('Failed to read file'))
        reader.onload = () => {
            const img = new Image()
            img.onerror = () => reject(new Error('Failed to load image'))
            img.onload = () => {
                let { width, height } = img

                if (width <= MAX_WIDTH) {
                    resolve(file)
                    return
                }

                const ratio = MAX_WIDTH / width
                width = MAX_WIDTH
                height = Math.round(height * ratio)

                const canvas = document.createElement('canvas')
                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    resolve(file)
                    return
                }

                ctx.drawImage(img, 0, 0, width, height)

                canvas.toBlob(
                    (blob) => {
                        if (!blob) {
                            resolve(file)
                            return
                        }
                        const compressed = new File(
                            [blob],
                            file.name.replace(/\.\w+$/, '.jpg'),
                            { type: 'image/jpeg', lastModified: Date.now() }
                        )
                        resolve(compressed)
                    },
                    'image/jpeg',
                    QUALITY
                )
            }
            img.src = reader.result as string
        }
        reader.readAsDataURL(file)
    })
}
