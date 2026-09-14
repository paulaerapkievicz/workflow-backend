import PDFDocument from 'pdfkit'

const BR_TZ = 'America/Sao_Paulo'

// Mesmo tratamento de acentos/tipografia do closingPdfService — evita que um nome/endereço
// fora da tabela WinAnsi derrube a geração do PDF inteiro.
const TYPOGRAPHIC: Record<string, string> = {
  '‘': "'", '’': "'", '“': '"', '”': '"',
  '–': '-', '—': '—', '…': '...', ' ': ' ',
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

const fmtDate = (d: Date | string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('pt-BR', { timeZone: BR_TZ }) : '—'

const fmtHours = (h: number | null | undefined) => `${Number(h ?? 0).toFixed(1).replace('.', ',')} h`

const fmtMoney = (v: number | string | null | undefined) => `R$ ${Number(v ?? 0).toFixed(2)}`

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  received: 'Recebido',
  awaiting: 'A receber',
  overdue: 'Atrasado',
}

const COLS = [
  { key: 'date', label: 'Data', width: 55 },
  { key: 'category', label: 'Função', width: 90 },
  { key: 'branch', label: 'Loja', width: 100 },
  { key: 'status', label: 'Situação', width: 65 },
  { key: 'contracted', label: 'H. contr.', width: 55 },
  { key: 'worked', label: 'H. trab.', width: 55 },
  { key: 'amount', label: 'Valor', width: 60 },
] as const

export interface FreelancerReportPdfItem {
  date: Date | string | null | undefined
  categoryName: string | null
  branchName: string | null
  contractedHours: number
  workedHours: number
  amount: number
  paymentStatus: 'received' | 'awaiting' | 'overdue' | null
}

export const freelancerReportPdfService = {
  /** Monta o PDF do relatório de trabalhos concluídos do colaborador (usado por Relatório e Meus Trabalhos). */
  buildReportPdf(freelancerName: string, items: FreelancerReportPdfItem[]): PDFKit.PDFDocument {
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const pageLeft = doc.page.margins.left
    const pageRight = doc.page.width - doc.page.margins.right

    doc.fontSize(18).font('Helvetica-Bold').text('Relatório de trabalhos')
    doc.moveDown(0.4)
    doc.fontSize(10).font('Helvetica').fillColor('#444')
    doc.text(pdfSafe(`Colaborador: ${freelancerName}`))
    doc.text(`Gerado em: ${fmtDate(new Date())}`)
    doc.fillColor('#000')
    doc.moveDown(1)

    const totals = {
      jobsCount: items.length,
      contractedHours: items.reduce((a, i) => a + i.contractedHours, 0),
      workedHours: items.reduce((a, i) => a + i.workedHours, 0),
      amount: items.reduce((a, i) => a + i.amount, 0),
    }
    doc.fontSize(13).font('Helvetica-Bold').text('Totais')
    doc.moveDown(0.3)
    doc.fontSize(10).font('Helvetica')
    doc.text(`Vagas concluídas: ${totals.jobsCount}`)
    doc.text(`Horas contratadas: ${fmtHours(totals.contractedHours)}`)
    doc.text(`Horas trabalhadas: ${fmtHours(totals.workedHours)}`)
    doc.text(`Valor total: ${fmtMoney(totals.amount)}`)
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

    doc.font('Helvetica').fontSize(8)
    items.forEach((item, i) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
        doc.addPage()
        drawHeader()
      }
      const row: Record<string, string> = {
        date: fmtDate(item.date),
        category: pdfSafe(item.categoryName ?? '—'),
        branch: pdfSafe(item.branchName ?? '—'),
        status: item.paymentStatus ? PAYMENT_STATUS_LABELS[item.paymentStatus] : '—',
        contracted: fmtHours(item.contractedHours),
        worked: fmtHours(item.workedHours),
        amount: fmtMoney(item.amount),
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

    if (!items.length) {
      doc.font('Helvetica-Oblique').fillColor('#666').text('Nenhuma vaga concluída neste período.')
      doc.fillColor('#000')
    }

    doc.end()
    return doc
  },
}
