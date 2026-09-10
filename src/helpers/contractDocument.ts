// src/helpers/contractDocument.ts
//
// Utilitários do documento de contrato: sanitização do HTML do modelo (o editor rich-text
// da agência produz um subconjunto pequeno de HTML) e conversão desse HTML para "blocos"
// que o gerador de PDF (pdfkit) sabe desenhar. Sem dependências externas — a entrada é
// controlada (saída do editor + edição da agência autenticada), então um tokenizador
// enxuto com allowlist é suficiente e evita libs de DOM no backend.

/** Tags de bloco que viram parágrafo/título/item no PDF. */
const BLOCK_TAGS = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'ul', 'ol', 'li', 'blockquote', 'hr', 'br', 'div'])
/** Tags inline preservadas (negrito/itálico/sublinhado). */
const INLINE_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 'span'])
const ALLOWED_TAGS = new Set([...BLOCK_TAGS, ...INLINE_TAGS])
/** Conteúdo dessas tags é descartado por completo. */
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta'])

interface Token {
  type: 'open' | 'close' | 'text' | 'void'
  tag?: string
  text?: string
}

function tokenize(html: string): Token[] {
  const tokens: Token[] = []
  const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b[^>]*?(\/?)>|<!--[\s\S]*?-->/g
  let last = 0
  let match: RegExpExecArray | null
  while ((match = re.exec(html))) {
    if (match.index > last) tokens.push({ type: 'text', text: html.slice(last, match.index) })
    last = re.lastIndex
    if (match[0].startsWith('<!--')) continue
    const tag = match[1].toLowerCase()
    const selfClosing = match[2] === '/' || tag === 'br' || tag === 'hr'
    const isClose = match[0].startsWith('</')
    if (isClose) tokens.push({ type: 'close', tag })
    else tokens.push({ type: selfClosing ? 'void' : 'open', tag })
  }
  if (last < html.length) tokens.push({ type: 'text', text: html.slice(last) })
  return tokens
}

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'",
}
function decodeEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&[a-z]+;|&#\d+;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m)
}
export function escapeHtml(text: string): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Reconstrói o HTML mantendo só as tags da allowlist e removendo todos os atributos. */
export function sanitizeContractHtml(html: string): string {
  const tokens = tokenize(String(html ?? ''))
  let out = ''
  let dropDepth = 0
  let dropTag = ''
  for (const tk of tokens) {
    if (dropDepth > 0) {
      if (tk.type === 'close' && tk.tag === dropTag) dropDepth--
      else if (tk.type === 'open' && tk.tag === dropTag) dropDepth++
      continue
    }
    if ((tk.type === 'open' || tk.type === 'void') && tk.tag && DROP_WITH_CONTENT.has(tk.tag)) {
      if (tk.type === 'open') { dropDepth = 1; dropTag = tk.tag }
      continue
    }
    if (tk.type === 'text') {
      out += escapeHtml(decodeEntities(tk.text ?? ''))
      continue
    }
    if (!tk.tag || !ALLOWED_TAGS.has(tk.tag)) continue
    if (tk.type === 'open') out += `<${tk.tag}>`
    else if (tk.type === 'close') out += `</${tk.tag}>`
    else out += tk.tag === 'br' ? '<br>' : `<${tk.tag}>`
  }
  return out.trim()
}

export interface DocRun {
  text: string
  bold?: boolean
  italic?: boolean
  underline?: boolean
}
export interface DocBlock {
  kind: 'p' | 'h1' | 'h2' | 'h3' | 'li' | 'hr'
  /** Marcador da lista, quando `kind === 'li'`. */
  marker?: string
  runs: DocRun[]
}

/** HTML sanitizado -> lista de blocos para o gerador de PDF. */
export function parseContractBlocks(sanitizedHtml: string): DocBlock[] {
  const tokens = tokenize(sanitizedHtml)
  const blocks: DocBlock[] = []
  const style = { bold: 0, italic: 0, underline: 0 }
  let current: DocBlock | null = null
  const listStack: { type: 'ul' | 'ol'; index: number }[] = []

  const flush = () => {
    if (current && (current.kind === 'hr' || current.runs.some((r) => r.text.trim() !== ''))) {
      blocks.push(current)
    }
    current = null
  }
  const startBlock = (kind: DocBlock['kind'], marker?: string) => {
    flush()
    current = { kind, runs: [], marker }
  }
  const pushText = (text: string) => {
    if (!text) return
    if (!current) current = { kind: 'p', runs: [] }
    current.runs.push({
      text,
      bold: style.bold > 0 || undefined,
      italic: style.italic > 0 || undefined,
      underline: style.underline > 0 || undefined,
    })
  }

  for (const tk of tokens) {
    if (tk.type === 'text') {
      pushText((tk.text ?? '').replace(/\s+/g, ' '))
      continue
    }
    const tag = tk.tag!
    const opening = tk.type === 'open' || tk.type === 'void'
    if (opening) {
      switch (tag) {
        case 'strong': case 'b': style.bold++; break
        case 'em': case 'i': style.italic++; break
        case 'u': style.underline++; break
        case 'br': pushText('\n'); break
        case 'hr': startBlock('hr'); flush(); break
        case 'h1': startBlock('h1'); break
        case 'h2': case 'h4': startBlock('h2'); break
        case 'h3': startBlock('h3'); break
        case 'p': case 'div': case 'blockquote': startBlock('p'); break
        case 'ul': listStack.push({ type: 'ul', index: 0 }); break
        case 'ol': listStack.push({ type: 'ol', index: 0 }); break
        case 'li': {
          const list = listStack[listStack.length - 1]
          if (list && list.type === 'ol') { list.index++; startBlock('li', `${list.index}.`) }
          else startBlock('li', '•')
          break
        }
      }
    } else {
      switch (tag) {
        case 'strong': case 'b': style.bold = Math.max(0, style.bold - 1); break
        case 'em': case 'i': style.italic = Math.max(0, style.italic - 1); break
        case 'u': style.underline = Math.max(0, style.underline - 1); break
        case 'ul': case 'ol': listStack.pop(); break
        case 'h1': case 'h2': case 'h3': case 'h4': case 'p': case 'div': case 'blockquote': case 'li':
          flush(); break
      }
    }
  }
  flush()
  return blocks
}

/** Texto puro (sem marcação) de um HTML sanitizado — usado em prévias curtas. */
export function contractPlainText(sanitizedHtml: string): string {
  return parseContractBlocks(sanitizedHtml)
    .map((b) => b.runs.map((r) => r.text).join(''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
