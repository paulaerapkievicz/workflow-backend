// src/services/contractPdfService.ts
//
// Gera o PDF do contrato assinado: o corpo do contrato (HTML já preenchido -> blocos) mais
// uma página final de "Comprovante de assinatura eletrônica" com a trilha de evidências.
// Mesmo cuidado de encoding do closingPdfService (Helvetica/WinAnsi + fallback para '?').

import PDFDocument from 'pdfkit'
import { parseContractBlocks, DocBlock } from '../helpers/contractDocument'
import { AgencyInstance } from '../models/Agency'
import { FreelancerContractSignatureInstance } from '../models/FreelancerContractSignature'

const BR_TZ = 'America/Sao_Paulo'
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')
const TYPOGRAPHIC: Record<string, string> = { '‘': "'", '’': "'", '“': '"', '”': '"', '–': '-', '…': '...' }

const pdfSafe = (value: unknown): string => {
  const raw = String(value ?? '')
  let out = ''
  for (const ch of raw) {
    const mapped = TYPOGRAPHIC[ch]
    if (mapped !== undefined) { out += mapped; continue }
    const code = ch.codePointAt(0) ?? 0
    if (code <= 0xff || WINANSI_EXTRA.has(ch)) out += ch
    else out += '?'
  }
  return out
}

const fmtDateTime = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: BR_TZ, dateStyle: 'long', timeStyle: 'medium' }) : '—'

const HEADING_SIZE: Record<string, number> = { h1: 17, h2: 14, h3: 12 }

function drawBlocks(doc: PDFKit.PDFDocument, blocks: DocBlock[]) {
  for (const block of blocks) {
    if (block.kind === 'hr') {
      const y = doc.y + 4
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke('#bbb')
      doc.moveDown(0.8)
      continue
    }
    const isHeading = block.kind === 'h1' || block.kind === 'h2' || block.kind === 'h3'
    const size = isHeading ? HEADING_SIZE[block.kind] : 10.5
    const indent = block.kind === 'li' ? 18 : 0
    const left = doc.page.margins.left + indent

    if (block.kind === 'li' && block.marker) {
      doc.font('Helvetica').fontSize(size).fillColor('#000')
      doc.text(pdfSafe(block.marker), doc.page.margins.left, doc.y, { width: indent, continued: false })
      doc.moveUp(1)
    }

    const runs = block.runs.length ? block.runs : [{ text: ' ' }]
    runs.forEach((run, i) => {
      const font = run.bold && run.italic ? 'Helvetica-BoldOblique'
        : run.bold ? 'Helvetica-Bold'
        : run.italic ? 'Helvetica-Oblique'
        : isHeading ? 'Helvetica-Bold' : 'Helvetica'
      doc.font(font).fontSize(size).fillColor('#000')
      doc.text(pdfSafe(run.text), i === 0 ? left : undefined, i === 0 ? doc.y : undefined, {
        width: doc.page.width - doc.page.margins.right - left,
        continued: i < runs.length - 1,
        underline: run.underline || false,
        align: isHeading ? 'left' : 'justify',
        lineGap: 2,
      })
    })
    doc.moveDown(isHeading ? 0.5 : 0.6)
  }
}

export const contractPdfService = {
  /** Rascunho do contrato ainda não assinado — só o corpo do documento, sem a página de evidências. */
  buildPreviewPdf(args: {
    renderedHtml: string
    title: string
    agency: Pick<AgencyInstance, 'name' | 'legalName' | 'cnpj'> | null
  }): PDFKit.PDFDocument {
    const { renderedHtml, title, agency } = args
    const doc = new PDFDocument({ margin: 56, size: 'A4' })

    doc.fontSize(9).font('Helvetica').fillColor('#666')
    doc.text(pdfSafe(agency?.legalName || agency?.name || 'Contrato'), { align: 'right' })
    if (agency?.cnpj) doc.text(pdfSafe(`CNPJ ${agency.cnpj}`), { align: 'right' })
    doc.fillColor('#b45309').font('Helvetica-Bold').text('RASCUNHO — documento ainda não assinado', { align: 'right' })
    doc.fillColor('#000').moveDown(1)

    doc.fontSize(15).font('Helvetica-Bold').text(pdfSafe(title), { align: 'center' })
    doc.moveDown(1)

    drawBlocks(doc, parseContractBlocks(renderedHtml))
    doc.end()
    return doc
  },

  buildContractPdf(args: {
    renderedHtml: string
    signature: Pick<
      FreelancerContractSignatureInstance,
      'id' | 'templateTitle' | 'signerName' | 'signerCpf' | 'signerEmail' | 'signedAt'
      | 'ipAddress' | 'userAgent' | 'contentHash' | 'acceptanceText'
    >
    agency: Pick<AgencyInstance, 'name' | 'legalName' | 'cnpj'> | null
    verifyUrl?: string
  }): PDFKit.PDFDocument {
    const { renderedHtml, signature, agency, verifyUrl } = args
    const doc = new PDFDocument({ margin: 56, size: 'A4' })

    // Cabeçalho
    doc.fontSize(9).font('Helvetica').fillColor('#666')
    doc.text(pdfSafe(agency?.legalName || agency?.name || 'Contrato'), { align: 'right' })
    if (agency?.cnpj) doc.text(pdfSafe(`CNPJ ${agency.cnpj}`), { align: 'right' })
    doc.fillColor('#000').moveDown(1)

    doc.fontSize(15).font('Helvetica-Bold').text(pdfSafe(signature.templateTitle), { align: 'center' })
    doc.moveDown(1)

    drawBlocks(doc, parseContractBlocks(renderedHtml))

    // Página de evidências
    doc.addPage()
    doc.fontSize(15).font('Helvetica-Bold').text('Comprovante de assinatura eletrônica')
    doc.moveDown(0.8)
    doc.fontSize(10).font('Helvetica').fillColor('#000')

    const row = (label: string, value: string) => {
      doc.font('Helvetica-Bold').text(`${label}: `, { continued: true })
      doc.font('Helvetica').text(pdfSafe(value))
      doc.moveDown(0.3)
    }
    row('Documento', signature.templateTitle)
    row('Signatário', `${signature.signerName} — CPF ${signature.signerCpf}`)
    if (signature.signerEmail) row('E-mail', signature.signerEmail)
    row('Assinado em', fmtDateTime(signature.signedAt))
    row('Endereço IP', signature.ipAddress || '—')
    row('Dispositivo', signature.userAgent || '—')
    row('Identificador do documento', signature.id)
    row('Código de verificação (SHA-256)', signature.contentHash)
    if (verifyUrl) row('Verificação', verifyUrl)

    doc.moveDown(0.5)
    doc.font('Helvetica-Bold').text('Declaração de aceite')
    doc.font('Helvetica').text(pdfSafe(`"${signature.acceptanceText}"`), { align: 'justify' })
    doc.moveDown(0.8)

    doc.fontSize(8.5).fillColor('#555').text(
      pdfSafe(
        'Documento assinado eletronicamente pelo signatário identificado acima, autenticado por ' +
        'login e senha na plataforma, nos termos do Art. 10, § 2º, da Medida Provisória nº 2.200-2/2001. ' +
        'A integridade pode ser conferida pelo código de verificação (SHA-256) sobre o conteúdo do contrato.'
      ),
      { align: 'justify' }
    )
    doc.fillColor('#000')

    doc.end()
    return doc
  },
}
