
import multer from 'multer'
import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { fileTypeFromBuffer } from 'file-type'

const UPLOAD_DIR = path.join(process.cwd(), 'uploads')

const ALLOWED_MIME = [
    'image/jpeg',
    'image/png',
    'image/webp'
]

const ALLOWED_EXT = [
    '.jpg',
    '.jpeg',
    '.png',
    '.webp'
]

// Reduce Sharp's memory usage on small servers
sharp.concurrency(1)
sharp.cache(false)

const storage = multer.memoryStorage()

// Check the reported MIME type and extension
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()

    if (
        ALLOWED_MIME.includes(file.mimetype) &&
        ALLOWED_EXT.includes(ext)
    ) {
        return cb(null, true)
    }

    return cb(
        new Error('Only JPEG, PNG and WebP images are allowed.')
    )
}

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 5
    }
})

// Validate and compress uploaded images
export const processImages = async (req, res, next) => {
    const savedFiles = []

    try {
        const files = req.file
            ? [req.file]
            : Array.isArray(req.files)
                ? req.files
                : Object.values(req.files || {}).flat()

        if (files.length === 0) {
            return next()
        }

        // Validate every file before writing any output
        for (const file of files) {
            const type = await fileTypeFromBuffer(file.buffer)

            if (!type || !ALLOWED_MIME.includes(type.mime)) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or corrupted image file.'
                })
            }

            const metadata = await sharp(file.buffer, {
                limitInputPixels: 25_000_000
            }).metadata()

            if (
                !metadata.width ||
                !metadata.height ||
                metadata.pages > 1
            ) {
                return res.status(400).json({
                    success: false,
                    message: 'Invalid or animated images are not supported.'
                })
            }
        }

        await fs.mkdir(UPLOAD_DIR, { recursive: true })

        const imagePaths = []

        // Process files sequentially to limit resource usage
        for (const file of files) {
            const filename =
                `${Date.now()}-${crypto.randomUUID()}.webp`

            const outputPath = path.join(UPLOAD_DIR, filename)

            await sharp(file.buffer, {
                limitInputPixels: 25_000_000
            })
                .rotate()
                .resize({
                    width: 1200,
                    height: 1200,
                    fit: 'inside',
                    withoutEnlargement: true
                })
                .webp({
                    quality: 75,
                    effort: 4
                })
                .toFile(outputPath)

            savedFiles.push(outputPath)
            imagePaths.push(`/uploads/${filename}`)
        }

        // Expose relative paths to controllers
        req.imagePath = imagePaths[0]
        req.imagePaths = imagePaths

        return next()
    } catch (err) {
        console.error('Image processing failed:', err)

        await Promise.allSettled(
            savedFiles.map(file => fs.unlink(file))
        )

        return res.status(400).json({
            success: false,
            message: 'Could not process uploaded images.'
        })
    }
}

export default upload
