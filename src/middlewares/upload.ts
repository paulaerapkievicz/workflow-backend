import path from 'path'
import crypto from 'crypto'
import fs from 'fs'
import multer from 'multer'

const uploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads')

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg'
    cb(null, `${crypto.randomUUID()}${ext}`)
  },
})

export const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) return cb(null, true)
    cb(new Error('Envie um arquivo de imagem.'))
  },
})

// Documentos (ex.: comprovante de pagamento) aceitam imagem OU PDF.
export const uploadDocument = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype) || file.mimetype === 'application/pdf') return cb(null, true)
    cb(new Error('Envie uma imagem ou um PDF.'))
  },
})
