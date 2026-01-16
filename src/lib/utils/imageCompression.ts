/**
 * Compresses an image file to reduce size for mobile uploads.
 * Uses canvas-based resizing and quality reduction.
 */

interface CompressionOptions {
    maxWidth?: number;
    maxHeight?: number;
    quality?: number; // 0-1, default 0.7
    mimeType?: 'image/jpeg' | 'image/webp';
}

const DEFAULT_OPTIONS: CompressionOptions = {
    maxWidth: 1920,
    maxHeight: 1920,
    quality: 0.7,
    mimeType: 'image/jpeg',
};

export async function compressImage(
    file: File,
    options: CompressionOptions = {}
): Promise<File> {
    const opts = { ...DEFAULT_OPTIONS, ...options };

    // Skip compression for small files (< 500KB)
    if (file.size < 500 * 1024) {
        return file;
    }

    // Skip non-image files
    if (!file.type.startsWith('image/')) {
        return file;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        img.onload = () => {
            URL.revokeObjectURL(img.src);

            if (!ctx) {
                reject(new Error('Failed to get canvas context'));
                return;
            }

            // Calculate new dimensions maintaining aspect ratio
            let { width, height } = img;
            const maxWidth = opts.maxWidth!;
            const maxHeight = opts.maxHeight!;

            if (width > maxWidth) {
                height = (height * maxWidth) / width;
                width = maxWidth;
            }

            if (height > maxHeight) {
                width = (width * maxHeight) / height;
                height = maxHeight;
            }

            canvas.width = width;
            canvas.height = height;

            // Draw image with smoothing
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);

            // Convert to blob
            canvas.toBlob(
                (blob) => {
                    if (!blob) {
                        reject(new Error('Failed to compress image'));
                        return;
                    }

                    // Create new file with compressed data
                    const compressedFile = new File(
                        [blob],
                        file.name.replace(/\.[^/.]+$/, `.${opts.mimeType === 'image/webp' ? 'webp' : 'jpg'}`),
                        { type: opts.mimeType, lastModified: Date.now() }
                    );

                    console.log(`[Image Compression] ${file.name}: ${(file.size / 1024).toFixed(1)}KB → ${(compressedFile.size / 1024).toFixed(1)}KB (${Math.round((1 - compressedFile.size / file.size) * 100)}% saved)`);

                    resolve(compressedFile);
                },
                opts.mimeType,
                opts.quality
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src);
            reject(new Error('Failed to load image'));
        };

        img.src = URL.createObjectURL(file);
    });
}

/**
 * Compresses multiple image files in parallel.
 */
export async function compressImages(
    files: File[],
    options: CompressionOptions = {}
): Promise<File[]> {
    return Promise.all(files.map(file => compressImage(file, options)));
}
