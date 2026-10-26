
import express from 'express'
import upload, { processImages } from '../middleware/upload.js'
import { uploadImage } from '../controllers/imagesController.js'
import { authenticate } from '../middleware/auth.js'

const router = express.Router()

router.post(
    '/',
    authenticate,
    upload.single('image'),
    processImages,
    uploadImage
)

export default router
