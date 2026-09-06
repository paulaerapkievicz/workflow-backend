import PDFDocument from 'pdfkit'
import { InvoiceInstance } from '../models/Invoice'

const BR_TZ = 'America/Sao_Paulo'

// As fontes padrão do pdfkit (Helvetica) usam WinAnsi/CP1252 — cobrem todos os acentos do
// português (á à â ã é ê í ó ô õ ú ç ñ ü …) e a maioria da pontuação. Caracteres fora dessa
// tabela (emoji, alfabetos não latinos, alguns símbolos) fariam o pdfkit lançar erro e
// derrubar a geração inteira do PDF. Este helper troca os equivalentes tipográficos comuns
// por ASCII e substitui o que sobrar por "?", pra um nome/endereço exótico nunca quebrar o
// fechamento. (Ver pendência 3 — encoding de caracteres especiais.)
const TYPOGRAPHIC: Record<string, string> = {
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '–': '-', '—': '—', '…': '...', ' ': ' ',
}
const WINANSI_EXTRA = new Set('€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ')

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
  d ? new Date(d).toLocaleString('pt-BR', { timeZone: BR_TZ, dateStyle: 'short', timeStyle: 'short' }) : '—'

// Formato compacto de uma linha só, pra caber na coluna da tabela sem quebrar (dd/mm hh:mm).
const fmtDateTimeShort = (d: Date | string | null | undefined) => {
  if (!d) return '—'
  const date = new Date(d)
  const day = date.toLocaleDateString('pt-BR', { timeZone: BR_TZ, day: '2-digit', month: '2-digit' })
  const time = date.toLocaleTimeString('pt-BR', { timeZone: BR_TZ, hour: '2-digit', minute: '2-digit' })
  return `${day} ${time}`
}

const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: BR_TZ }) : '—'

const fmtHours = (minutes: number | null | undefined) => {
  const m = Number(minutes ?? 0)
  const h = Math.floor(m / 60)
  const rest = Math.round(m % 60)
  return `${h}h${rest ? ` ${rest}min` : ''}`
}

const fmtMoney = (v: number | string | null | undefined) => `R$ ${Number(v ?? 0).toFixed(2)}`

/** Menor check-in e maior check-out entre os turnos da vaga — cobre vagas com mais de um turno. */
function checkInOut(shifts: any[]) {
  const ins = shifts.map((s) => s.checkInAt).filter(Boolean).map((d) => new Date(d).getTime())
  const outs = shifts.map((s) => s.checkOutAt).filter(Boolean).map((d) => new Date(d).getTime())
  return {
    checkInAt: ins.length ? new Date(Math.min(...ins)) : null,
    checkOutAt: outs.length ? new Date(Math.max(...outs)) : null,
  }
}

const COLS = [
  { key: 'date', label: 'Data', width: 55 },
  { key: 'category', label: 'Função', width: 75 },
  { key: 'branch', label: 'Filial', width: 75 },
  { key: 'freelancer', label: 'Colaborador', width: 85 },
  { key: 'checkIn', label: 'Check-in', width: 70 },
  { key: 'checkOut', label: 'Check-out', width: 70 },
  { key: 'hours', label: 'Horas', width: 45 },
  { key: 'amount', label: 'Valor', width: 55 },
] as const

export const closingPdfService = {
  /** Monta o PDF do fechamento (referência, data de geração, totais, vagas com check-in/out). */
  buildClosingPdf(invoice: InvoiceInstance): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const inv: any = invoice
    const pageLeft = doc.page.margins.left
    const pageRight = doc.page.width - doc.page.margins.right

    doc.fontSize(18).font('Helvetica-Bold').text('Fechamento mensal')
    doc.moveDown(0.4)
    doc.fontSize(10).font('Helvetica').fillColor('#444')
    doc.text(pdfSafe(`Agência: ${inv.invoiceAgency?.name ?? '—'}`))
    doc.text(pdfSafe(`Supermercado: ${inv.invoiceSupermarket?.name ?? '—'}`))
    doc.text(pdfSafe(`Filial: ${inv.invoiceBranch?.name ?? 'Toda a rede (matriz)'}`))
    doc.text(pdfSafe(`Mês de referência: ${inv.referenceMonth}`))
    doc.text(`Gerado em: ${fmtDateTime(new Date())}`)
    doc.fillColor('#000')
    doc.moveDown(1)

    doc.fontSize(13).font('Helvetica-Bold').text('Totais')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    doc.text(`Vagas concluídas: ${inv.totalJobs}`)
    doc.text(`Horas contratadas: ${fmtHours(inv.contractedMinutes)}`)
    doc.text(`Horas trabalhadas: ${fmtHours(inv.workedMinutes)}`)
    doc.text(`Valor total: ${fmtMoney(inv.totalAmount)}`)
    doc.moveDown(1)

    doc.fontSize(13).font('Helvetica-Bold').text('Vagas do período')
    doc.moveDown(0.5)

    const drawHeader = () => {
      let x = pageLeft
      doc.font('Helvetica-Bold').fontSize(8).fillColor('#fff')
      const y = doc.y
      doc.rect(pageLeft, y - 2, pageRight - pageLeft, 16).fill('#4e6cff')
      doc.fillColor('#fff')
      for (const col of COLS) {
        doc.text(col.label, x + 3, y + 1, { width: col.width - 6 })
        x += col.width
      }
      doc.fillColor('#000')
      doc.moveDown(1.1)
    }

    drawHeader()

    const jobs: any[] = inv.invoiceJobs ?? []
    doc.font('Helvetica').fontSize(8)
    jobs.forEach((job, i) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage()
        drawHeader()
      }
      const { checkInAt, checkOutAt } = checkInOut(job.shifts ?? [])
      const row: Record<string, string> = {
        date: fmtDate(job.startTime),
        category: pdfSafe(job.jobCategory?.name ?? '—'),
        branch: pdfSafe(job.jobBranch?.name ?? '—'),
        freelancer: pdfSafe(job.assignedFreelancer?.name ?? '—'),
        checkIn: fmtDateTimeShort(checkInAt),
        checkOut: fmtDateTimeShort(checkOutAt),
        hours: fmtHours(job.workedMinutes),
        amount: fmtMoney(job.grossAmount),
      }
      const y = doc.y
      if (i % 2 === 1) doc.rect(pageLeft, y - 2, pageRight - pageLeft, 14).fill('#f4f6fb').fillColor('#000')
      let x = pageLeft
      for (const col of COLS) {
        doc.text(row[col.key], x + 3, y, { width: col.width - 6, height: 10, ellipsis: true, lineBreak: false })
        x += col.width
      }
      doc.y = y
      doc.moveDown(0.95)
    })

    if (!jobs.length) {
      doc.font('Helvetica-Oblique').fillColor('#666').text('Nenhuma vaga neste fechamento.')
      doc.fillColor('#000')
    }

    doc.end()
    return doc
  },
}
