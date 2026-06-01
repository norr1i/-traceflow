'use client'

import jsPDF from 'jspdf'
import JSZip from 'jszip'

// ── Enterprise palette ─────────────────────────────────────────────────────────
const C = {
  dark:   [20,  30,  50]  as const,
  text:   [32,  40,  54]  as const,
  muted:  [75,  90,  108] as const,
  subtle: [120, 135, 155] as const,
  blue:   [29,  78,  137] as const,
  rule:   [210, 216, 226] as const,
  border: [218, 224, 234] as const,
  red:    [168, 18,  18]  as const,
  amber:  [145, 84,  0]   as const,
  green:  [14,  104, 45]  as const,
  slate:  [88,  102, 122] as const,
  rowalt: [246, 248, 252] as const,
  rowhdr: [222, 229, 243] as const,
  certbg: [247, 249, 254] as const,   // certification / verification section tint
  paper:  [252, 252, 250] as const,   // warm paper depth — barely perceptible
  wmk1:   [244, 248, 254] as const,   // main diagonal watermark (~4 % equivalent)
  wmk2:   [249, 252, 255] as const,   // background typography (~2 % equivalent)
  white:  [255, 255, 255] as const,
}

// ── Layout (A4 portrait, mm) ───────────────────────────────────────────────────
const PW    = 210
const PH    = 297
const ML    = 20
const MR    = 20
const CW    = PW - ML - MR   // 170 mm
const LBL   = 42              // label column width for field() rows
const HDR1  = 76              // first-page content start y
const HDRC  = 22              // continuation-page content start y
const FOOTY = 276             // footer rule y
const GUARD = 14              // newPage trigger threshold

// ── Low-level color helpers ───────────────────────────────────────────────────
function tc(doc: jsPDF, c: readonly [number, number, number]) { doc.setTextColor(c[0], c[1], c[2]) }
function dc(doc: jsPDF, c: readonly [number, number, number]) { doc.setDrawColor(c[0], c[1], c[2]) }
function fc(doc: jsPDF, c: readonly [number, number, number]) { doc.setFillColor(c[0], c[1], c[2]) }

// Auto-detects compliance keywords → appropriate status colour
function cellStatusColor(val: string): readonly [number, number, number] {
  const v = val.toUpperCase().trim()
  const gSet = new Set(['PASS', 'RELEASED', 'CLOSED', 'COMPLIANT', 'VERIFIED',
    'APPROVED', 'ELECTRONICALLY SIGNED', 'HASH VALIDATED', 'INITIAL ISSUE', 'COMPLETE'])
  const rSet = new Set(['FAIL', 'CRITICAL', 'OVERDUE', 'ON HOLD', 'NON-CONFORMITY'])
  const aSet = new Set(['MAJOR', 'IN PROGRESS', 'PARTIAL', 'UNDER REVIEW'])
  const bSet = new Set(['OPEN', 'INFORMATION', 'PENDING'])
  const sSet = new Set(['MINOR'])
  if (gSet.has(v)) return C.green
  if (rSet.has(v)) return C.red
  if (aSet.has(v)) return C.amber
  if (bSet.has(v)) return C.blue
  if (sSet.has(v)) return C.slate
  return C.text
}

// ── Report context (passed from client component — no fake fallbacks) ─────────
export interface ReportContext {
  companyName: string
}

// ── Public utilities ──────────────────────────────────────────────────────────
export function nowGregorian(): string {
  const d     = new Date()
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit',
    day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d)
  const g = (t: string) => parts.find(p => p.type === t)?.value ?? ''
  const hh = g('hour') === '24' ? '00' : g('hour')
  return `${g('year')}-${g('month')}-${g('day')} ${hh}:${g('minute')}`
}

export function todayStr(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

export function pdfHash(): string {
  return `TF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href = url; a.download = filename
  document.body.appendChild(a); a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

// ── DocMeta ───────────────────────────────────────────────────────────────────
export interface DocMeta {
  title:     string
  docNo:     string
  version:   string
  generated: string
  hash:      string
  classif:   string
  regRef:    string
}

// ── PDFDoc ────────────────────────────────────────────────────────────────────
class PDFDoc {
  private doc:   jsPDF
  private y:     number
  private pageN: number
  readonly meta: DocMeta

  constructor(meta: DocMeta) {
    this.doc   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    this.meta  = meta
    this.pageN = 1
    this.drawFirstHeader()
    this.y = HDR1
  }

  // ── Page background: warm paper tint + scattered typography + main diagonal ─
  private drawPageBackground() {
    const { doc } = this

    // Barely-warm paper depth — differentiates from flat white
    fc(doc, C.paper); doc.rect(0, 0, PW, PH, 'F')

    // Background typography — very faint, scattered across the page
    // Positions chosen to cover the full sheet without clustering near content
    const bgWords: [string, number, number, number, number][] = [
      // [text,          x,     y,    angle, size]
      ['TRACEFLOW',      22,    62,   -14,   20],
      ['SFDA',          162,   205,    16,   24],
      ['COMPLIANCE',     32,   238,     7,   14],
      ['VERIFIED',      108,   117,    -9,   16],
      ['GMP',            16,   158,    26,   23],
      ['REGULATORY',     56,   272,     5,   11],
    ]
    doc.setFont('helvetica', 'bold')
    tc(doc, C.wmk2)
    bgWords.forEach(([text, x, y, angle, size]) => {
      doc.setFontSize(size)
      doc.text(text, x, y, { angle })
    })

    // Main diagonal — slightly stronger to read as primary watermark
    doc.setFontSize(28)
    tc(doc, C.wmk1)
    doc.text('CONFIDENTIAL', PW / 2, PH / 2, { angle: 45, align: 'center' })
  }

  // ── First-page header ─────────────────────────────────────────────────────
  private drawFirstHeader() {
    const { doc, meta } = this
    this.drawPageBackground()

    // 3.5 mm IBM-blue accent bar
    fc(doc, C.blue); doc.rect(0, 0, PW, 3.5, 'F')

    // Platform branding
    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    tc(doc, C.muted)
    doc.text('TraceFlow Regulatory Compliance Engine', ML, 11)

    // Classification label
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
    tc(doc, C.red)
    doc.text(meta.classif, PW - MR, 11, { align: 'right' })

    // Document title
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17)
    tc(doc, C.dark)
    doc.text(meta.title, ML, 23)

    // Rule under title
    dc(doc, C.rule); doc.setLineWidth(0.4)
    doc.line(ML, 28.5, PW - MR, 28.5)

    // Metadata grid
    const baseMeta: [string, string, boolean?][] = [
      ['Document No.',    meta.docNo],
      ['Generated',       meta.generated],
      ['Version',         meta.version],
      ['Regulatory Ref.', meta.regRef],
      ['Integrity Hash',  meta.hash, true],
    ]
    let my = 35.5
    baseMeta.forEach(([lbl, val, mono]) => {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7)
      tc(doc, C.muted)
      doc.text(lbl, ML, my)
      doc.setFont(mono ? 'courier' : 'helvetica', 'normal')
      doc.setFontSize(mono ? 6.5 : 7.5)
      tc(doc, mono ? C.subtle : C.text)
      const lines = doc.splitTextToSize(val, CW - LBL - 2)
      doc.text(lines, ML + LBL, my)
      my += lines.length > 1 ? lines.length * 4.3 + 0.5 : 5.2
    })

    // Rule below metadata block
    const ruleY = Math.max(my + 2, 67)
    dc(doc, C.rule); doc.setLineWidth(0.35)
    doc.line(ML, ruleY, PW - MR, ruleY)
  }

  // ── Continuation-page header ──────────────────────────────────────────────
  private drawContHeader() {
    const { doc, meta } = this
    this.drawPageBackground()

    fc(doc, C.blue); doc.rect(0, 0, PW, 3, 'F')

    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5)
    tc(doc, C.dark)
    doc.text(meta.title, ML, 10)

    doc.setFont('helvetica', 'normal'); doc.setFontSize(7)
    tc(doc, C.muted)
    doc.text(meta.docNo, PW - MR, 10, { align: 'right' })

    dc(doc, C.rule); doc.setLineWidth(0.3)
    doc.line(ML, 14, PW - MR, 14)
  }

  // ── Footer — stamped in finalize two-pass ─────────────────────────────────
  private drawFooter(page: number, total: number) {
    const { doc, meta } = this

    dc(doc, C.rule); doc.setLineWidth(0.2)
    doc.line(ML, FOOTY, PW - MR, FOOTY)

    // Line 1: platform · docNo  |  Page N of M
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5)
    tc(doc, C.muted)
    doc.text(`TraceFlow Regulatory Compliance Engine  ·  ${meta.docNo}`, ML, FOOTY + 5)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5)
    tc(doc, C.muted)
    doc.text(`Page ${page} of ${total}`, PW - MR, FOOTY + 5, { align: 'right' })

    // Line 2: platform tag  |  CONFIDENTIAL
    doc.setFont('helvetica', 'normal'); doc.setFontSize(6)
    tc(doc, C.subtle)
    doc.text('Generated by TraceFlow Compliance Platform', ML, FOOTY + 10)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6)
    tc(doc, C.subtle)
    doc.text('CONFIDENTIAL', PW - MR, FOOTY + 10, { align: 'right' })
  }

  finalize(): this {
    const total = this.doc.getNumberOfPages()
    for (let p = 1; p <= total; p++) {
      this.doc.setPage(p); this.drawFooter(p, total)
    }
    return this
  }

  // ── Page management ────────────────────────────────────────────────────────
  private newPage() {
    this.doc.addPage(); this.pageN++
    this.drawContHeader(); this.y = HDRC
  }

  private ensure(h: number) {
    if (this.y + h > FOOTY - GUARD) this.newPage()
  }

  // ── Content primitives ─────────────────────────────────────────────────────

  spacer(h = 5) { this.y += h }

  sectionTitle(text: string, minFollowing = 0) {
    this.ensure(19 + minFollowing)
    this.spacer(3)
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(8)
    tc(this.doc, C.blue)
    this.doc.text(text.toUpperCase(), ML, this.y)
    dc(this.doc, C.rule); this.doc.setLineWidth(0.25)
    this.doc.line(ML, this.y + 3, ML + CW, this.y + 3)
    this.y += 9
  }

  field(label: string, value: string,
    opts: { color?: readonly [number,number,number]; bold?: boolean; mono?: boolean } = {}
  ) {
    if (!value) return
    const vlines = this.doc.splitTextToSize(value, CW - LBL - 4)
    this.ensure(vlines.length * 4.5 + 1.5)
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(7)
    tc(this.doc, C.muted)
    this.doc.text(label, ML, this.y)
    this.doc.setFont(opts.mono ? 'courier' : 'helvetica', opts.bold ? 'bold' : 'normal')
    this.doc.setFontSize(opts.mono ? 7 : 8)
    tc(this.doc, opts.color ?? C.text)
    vlines.forEach((line: string, i: number) => {
      this.doc.text(line, ML + LBL, this.y + i * 4.5)
    })
    this.y += vlines.length * 4.5 + 1.5
  }

  statusRow(label: string, value: string, level: 'ok'|'partial'|'error'|'warn'|'info') {
    const col = { ok: C.green, partial: C.amber, error: C.red, warn: C.amber, info: C.blue }[level]
    const h   = 9
    this.ensure(h + 2)
    const y0 = this.y
    fc(this.doc, C.rowalt);  this.doc.rect(ML, y0, CW, h, 'F')
    fc(this.doc, col);       this.doc.rect(ML, y0, 3, h, 'F')
    dc(this.doc, C.border); this.doc.setLineWidth(0.12)
    this.doc.line(ML, y0 + h, ML + CW, y0 + h)
    this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(7.5)
    tc(this.doc, C.muted)
    this.doc.text(label, ML + 7, y0 + 6)
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(7.5)
    tc(this.doc, col)
    this.doc.text(value, ML + CW - 3, y0 + 6, { align: 'right' })
    this.y = y0 + h + 1
  }

  scorecard(items: Array<{ label: string; value: string; level: 'ok'|'partial'|'error'|'warn'|'info' }>) {
    const cols  = 2
    const gap   = 4
    const cellW = (CW - gap) / cols
    const cellH = 20
    const rows  = Math.ceil(items.length / cols)
    this.ensure(cellH * rows + 6)
    const startY = this.y
    items.forEach((item, i) => {
      const col   = i % cols
      const row   = Math.floor(i / cols)
      const cx    = ML + col * (cellW + gap)
      const cy    = startY + row * cellH
      const color = { ok: C.green, partial: C.amber, error: C.red, warn: C.amber, info: C.blue }[item.level]
      fc(this.doc, C.rowalt);  this.doc.rect(cx, cy, cellW, cellH - 2, 'F')
      fc(this.doc, color);     this.doc.rect(cx, cy, cellW, 3, 'F')
      dc(this.doc, C.border); this.doc.setLineWidth(0.2)
      this.doc.rect(cx, cy, cellW, cellH - 2, 'S')
      this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(6.5)
      tc(this.doc, C.muted)
      this.doc.text(item.label.toUpperCase(), cx + 5, cy + 10)
      this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(12)
      tc(this.doc, color)
      this.doc.text(item.value, cx + 5, cy + 16.5)
    })
    this.y = startY + rows * cellH + 4
  }

  bullet(text: string, color: readonly [number,number,number] = C.text) {
    const lines = this.doc.splitTextToSize(text, CW - 12)
    this.ensure(lines.length * 4.5 + 2)
    this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(8)
    tc(this.doc, C.blue); this.doc.text('-', ML + 2, this.y)
    tc(this.doc, color);  this.doc.text(lines, ML + 8, this.y)
    this.y += lines.length * 4.5 + 1
  }

  note(text: string) {
    const lines = this.doc.splitTextToSize(text, CW - 16)
    this.ensure(lines.length * 4.0 + 2)
    this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(7)
    tc(this.doc, C.subtle)
    lines.forEach((line: string, i: number) => {
      this.doc.text(line, ML + 8, this.y + i * 4.0)
    })
    this.y += lines.length * 4.0 + 1.5
  }

  // Structured finding/exception block: ID header band + description + muted note
  findingBlock(id: string, description: string, noteText: string) {
    const idH = 8
    this.ensure(idH + 22)
    const y0 = this.y
    fc(this.doc, C.rowalt); this.doc.rect(ML, y0, CW, idH, 'F')
    fc(this.doc, C.blue);   this.doc.rect(ML, y0, 3, idH, 'F')
    dc(this.doc, C.border); this.doc.setLineWidth(0.1)
    this.doc.line(ML, y0 + idH, ML + CW, y0 + idH)
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(8)
    tc(this.doc, C.dark)
    this.doc.text(id, ML + 8, y0 + 5.5)
    this.y = y0 + idH + 3.5

    const descLines = this.doc.splitTextToSize(description, CW - 10)
    this.ensure(descLines.length * 4.5 + 2)
    this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(8)
    tc(this.doc, C.text)
    descLines.forEach((line: string, i: number) => {
      this.doc.text(line, ML + 5, this.y + i * 4.5)
    })
    this.y += descLines.length * 4.5 + 2.5

    if (noteText) {
      const nLines = this.doc.splitTextToSize(noteText, CW - 10)
      this.ensure(nLines.length * 4.0 + 4)
      this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(7)
      tc(this.doc, C.subtle)
      nLines.forEach((line: string, i: number) => {
        this.doc.text(line, ML + 5, this.y + i * 4.0)
      })
      this.y += nLines.length * 4.0 + 3
    }

    dc(this.doc, C.border); this.doc.setLineWidth(0.12)
    this.doc.line(ML + 4, this.y, ML + CW, this.y)
    this.y += 3
  }

  divider() {
    this.ensure(9)
    dc(this.doc, C.border); this.doc.setLineWidth(0.2)
    this.doc.line(ML + 8, this.y + 3, ML + CW, this.y + 3)
    this.y += 9
  }

  // Enterprise table — proportional padding, auto-color status cells
  table(headers: string[], rows: string[][], widths?: number[]) {
    const cols = headers.length
    const ws   = widths ?? headers.map(() => +(CW / cols).toFixed(1))
    const hrh  = 9      // header row height
    const drh  = 8      // data row height
    const hp   = 3      // horizontal cell padding

    this.ensure(hrh + drh + 5)
    const tsY = this.y

    // Header
    fc(this.doc, C.rowhdr); this.doc.rect(ML, tsY, CW, hrh, 'F')
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(7)
    tc(this.doc, C.dark)
    let x = ML + hp
    headers.forEach((h, i) => {
      const maxW = ws[i] - hp * 2
      const txt  = this.doc.splitTextToSize(h, maxW)[0] ?? h
      this.doc.text(txt, x, tsY + 6)
      x += ws[i]
    })

    // Header separator
    dc(this.doc, C.blue); this.doc.setLineWidth(0.4)
    this.doc.line(ML, tsY + hrh, ML + CW, tsY + hrh)
    this.y = tsY + hrh

    // Data rows
    rows.forEach((row, ri) => {
      this.ensure(drh)
      const rowY = this.y
      if (ri % 2 === 1) { fc(this.doc, C.rowalt); this.doc.rect(ML, rowY, CW, drh, 'F') }
      this.doc.setFont('helvetica', 'normal'); this.doc.setFontSize(7)
      x = ML + hp
      row.forEach((cell, ci) => {
        const txt = this.doc.splitTextToSize(cell, ws[ci] - hp * 2)[0] ?? ''
        tc(this.doc, cellStatusColor(txt))
        this.doc.text(txt, x, rowY + 5.4)
        x += ws[ci]
      })
      dc(this.doc, C.border); this.doc.setLineWidth(0.1)
      this.doc.line(ML, rowY + drh, ML + CW, rowY + drh)
      this.y = rowY + drh
    })

    // Column separators — thin vertical rules between columns
    const tableH = hrh + rows.length * drh
    dc(this.doc, C.border); this.doc.setLineWidth(0.08)
    let sepX = ML
    ws.slice(0, -1).forEach(w => {
      sepX += w
      this.doc.line(sepX, tsY, sepX, tsY + tableH)
    })

    // Outer border
    dc(this.doc, C.border); this.doc.setLineWidth(0.2)
    this.doc.rect(ML, tsY, CW, tableH, 'S')
    this.y += 5
  }

  // CAPA detail block — prominent header band, status pill, severity label
  capaBlock(b: {
    id: string; finding: string; ncClass: string; severity: string
    due: string; assigned: string; root: string
    corrective: string; preventive: string; evidRef: string
    status: string; statusNote: string
  }) {
    this.ensure(48)

    const sCol = b.status === 'CLOSED'     ? C.green
               : b.status === 'OVERDUE'    ? C.red
               : b.severity === 'CRITICAL' ? C.red
               : b.severity === 'MAJOR'    ? C.amber
               : C.slate

    const hH = 10, y0 = this.y
    // Header band
    fc(this.doc, C.rowalt); this.doc.rect(ML, y0, CW, hH, 'F')
    fc(this.doc, sCol);     this.doc.rect(ML, y0, 4, hH, 'F')
    // CAPA ID
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(9)
    tc(this.doc, C.dark); this.doc.text(b.id, ML + 9, y0 + 7)
    // Status pill
    const pillW = 28
    fc(this.doc, sCol); this.doc.rect(PW - MR - pillW, y0 + 2.5, pillW, 5.5, 'F')
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(6)
    tc(this.doc, C.white)
    this.doc.text(b.status, PW - MR - 2.5, y0 + 6.5, { align: 'right' })
    // Severity label
    this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(6.5)
    tc(this.doc, sCol)
    this.doc.text(b.severity, PW - MR - pillW - 3, y0 + 6.8, { align: 'right' })
    // Rule under header
    dc(this.doc, C.border); this.doc.setLineWidth(0.12)
    this.doc.line(ML, y0 + hH, ML + CW, y0 + hH)
    this.y = y0 + hH + 3

    const indent = 6
    const ifield = (lbl: string, val: string, opts?: { color?: readonly [number,number,number]; bold?: boolean; mono?: boolean }) => {
      if (!val) return
      const vl = this.doc.splitTextToSize(val, CW - LBL - indent - 4)
      this.ensure(vl.length * 4.5 + 1)
      this.doc.setFont('helvetica', 'bold'); this.doc.setFontSize(7)
      tc(this.doc, C.muted); this.doc.text(lbl, ML + indent, this.y)
      this.doc.setFont(opts?.mono ? 'courier' : 'helvetica', opts?.bold ? 'bold' : 'normal')
      this.doc.setFontSize(opts?.mono ? 7 : 8)
      tc(this.doc, opts?.color ?? C.text)
      vl.forEach((line: string, i: number) => {
        this.doc.text(line, ML + indent + LBL, this.y + i * 4.5)
      })
      this.y += vl.length * 4.5 + 1.5
    }

    ifield('Finding',              b.finding)
    ifield('Non-Conformity Class', b.ncClass,   { color: sCol, bold: true })
    ifield('Due Date',             b.due)
    ifield('Assigned To',          b.assigned)
    ifield('Root Cause',           b.root)
    ifield('Corrective Action',    b.corrective)
    ifield('Preventive Action',    b.preventive)
    ifield('Evidence Reference',   b.evidRef,   { color: C.blue, mono: true })
    if (b.statusNote) ifield('Status Note', b.statusNote, { color: sCol })

    this.y += 1
    dc(this.doc, C.border); this.doc.setLineWidth(0.12)
    this.doc.line(ML + 6, this.y, ML + CW, this.y)
    this.y += 4
  }

  // ── Output ─────────────────────────────────────────────────────────────────
  blob(): Blob {
    this.finalize()
    return this.doc.output('blob')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF BUILDERS
// ─────────────────────────────────────────────────────────────────────────────

export function buildQCReportPDF(ctx: ReportContext): Blob {
  const ts   = nowGregorian()
  const hash = pdfHash()
  const date = todayStr()
  const p = new PDFDoc({
    title:     'QC Inspection Report',
    docNo:     `QC-RPT-${date.replace(/-/g, '')}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL',
    regRef:    'Saudi FDA GMP Guidelines v2024  |  SOP-QC-001',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('Executive Summary', 32)
  p.field('Reporting Period', 'Current period')
  p.field('Report Generated', ts)
  p.bullet('QC inspection records are managed in TraceFlow. Export batch-level inspection data to populate detailed rows in this report.')

  p.spacer(3)
  p.sectionTitle('Batch Inspection Results', 60)
  p.bullet('No QC inspection records found in the system. Log inspections in TraceFlow to populate this section.')

  p.spacer(3)
  p.sectionTitle('Audit Observations', 22)
  p.bullet('All inspections must be conducted per applicable SOP and Saudi FDA GMP Guidelines.')
  p.bullet('Connect inspection records in TraceFlow to generate detailed audit observations.')

  p.spacer(3)
  p.sectionTitle('Compliance Verification Status', 33)
  p.statusRow('QC Process Compliance',        'See TraceFlow QC module for current status', 'partial')
  p.statusRow('Documentation Compliance',     'No records on file',                         'partial')
  p.statusRow('Equipment Calibration Status', 'Not configured',                             'partial')

  return p.blob()
}

export function buildBatchReportPDF(ctx: ReportContext): Blob {
  const ts   = nowGregorian()
  const hash = pdfHash()
  const date = todayStr()
  const p = new PDFDoc({
    title:     'Batch Traceability Report',
    docNo:     `BCR-${date.replace(/-/g, '')}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL',
    regRef:    'Saudi FDA GMP Guidelines v2024  |  PROD-TRACE-LOGS',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('Batch Lifecycle Summary', 25)
  p.field('Report Generated', ts)
  p.bullet('Batch history records are managed in TraceFlow. Log production orders and batch records to populate this report.')

  p.spacer(3)
  p.sectionTitle('Recent Batch Records', 60)
  p.bullet('No batch records found in the system. Record production orders in TraceFlow to populate this section.')

  p.spacer(3)
  p.sectionTitle('Traceability Chain Structure', 30)
  p.table(
    ['Forward Traceability Chain', 'Backward Traceability Chain'],
    [
      ['1.  Raw Material Receipt', '1.  Customer'],
      ['2.  Production',           '2.  Batch'],
      ['3.  QC Inspection',        '3.  Production Order'],
      ['4.  Storage',              '4.  Raw Material Lot'],
      ['5.  Dispatch',             '5.  Supplier'],
    ],
    [85, 85]
  )

  p.spacer(3)
  p.sectionTitle('Traceability Exceptions', 36)
  p.bullet('No traceability exceptions on record.')

  p.sectionTitle('Compliance Verification Status', 30)
  p.statusRow('Batch Traceability',     'See TraceFlow for current coverage', 'partial')
  p.statusRow('Non-Conformant Batches', 'No records on file',                 'partial')
  p.statusRow('Remediation Progress',   'No open corrective actions',         'partial')

  return p.blob()
}

export function buildNCRReportPDF(ctx: ReportContext): Blob {
  const ts   = nowGregorian()
  const hash = pdfHash()
  const date = todayStr()
  const p = new PDFDoc({
    title:     'Non-Conformance Report',
    docNo:     `NCR-${date.replace(/-/g, '')}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL',
    regRef:    'Saudi FDA GMP Guidelines v2024  |  SOP-NCR-001',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('Non-Conformance Summary', 30)
  p.field('Report Generated', ts)
  p.bullet('Non-conformance records are managed in TraceFlow. Log NCR events to populate this report.')

  p.spacer(3)
  p.sectionTitle('Non-Conformance Register', 60)
  p.bullet('No NCR records found in the system. Record non-conformances in TraceFlow to populate this section.')

  p.spacer(3)
  p.sectionTitle('Root Cause Analysis & Remediation Status', 50)
  p.bullet('No root cause analysis records found. Connect NCR module in TraceFlow to populate.')

  p.spacer(2)
  p.statusRow('Overall NCR Status',  'No records on file', 'partial')
  p.statusRow('Open Non-Conformances', 'None recorded',    'ok')

  return p.blob()
}

export function buildRecallReportPDF(ctx: ReportContext): Blob {
  const ts   = nowGregorian()
  const hash = pdfHash()
  const date = todayStr()
  const p = new PDFDoc({
    title:     'Recall Summary Report',
    docNo:     `RCL-${date.replace(/-/g, '')}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL',
    regRef:    'Saudi FDA Recall Procedure  |  SOP-RECALL-001',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('Recall Events Summary', 22)
  p.field('Report Generated', ts)
  p.bullet('Recall event records are managed in TraceFlow. Initiate recall events via the Recall module to populate this report.')

  p.sectionTitle('Recall Event Register', 80)
  p.bullet('No recall events on record.')

  p.sectionTitle('Recall Readiness Assessment', 40)
  p.statusRow('Time to Notify',              'Automated notification available via TraceFlow', 'ok')
  p.statusRow('Batch Identification Method', 'Real-time traceability via TraceFlow',           'ok')
  p.statusRow('Recall Events on Record',     'None recorded',                                  'ok')

  return p.blob()
}

export function buildCAPAReportPDF(ctx: ReportContext): Blob {
  const ts   = nowGregorian()
  const hash = pdfHash()
  const date = todayStr()
  const p = new PDFDoc({
    title:     'CAPA Summary Report',
    docNo:     `CAPA-RPT-${date.replace(/-/g, '')}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL',
    regRef:    'ICH Q10 Pharmaceutical Quality System',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('CAPA Register — Executive Summary', 46)
  p.field('Report Generated', ts)
  p.bullet('CAPA records are managed in TraceFlow. Add corrective and preventive actions via the CAPA module to populate this report.')

  p.spacer(2)
  p.sectionTitle('CAPA Status Overview', 60)
  p.bullet('No CAPA records found in the system.')

  p.spacer(3)
  p.sectionTitle('Compliance Verification Status', 33)
  p.statusRow('Open CAPAs',               'None recorded', 'ok')
  p.statusRow('Overdue CAPAs',            'None recorded', 'ok')
  p.statusRow('Effectiveness Verification', 'No items pending', 'ok')

  return p.blob()
}

export function buildGMPReportPDF(ctx: ReportContext): Blob {
  const ts   = nowGregorian()
  const hash = pdfHash()
  const date = todayStr()
  const p = new PDFDoc({
    title:     'GMP Audit Report',
    docNo:     `GMP-${date.replace(/-/g, '')}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL',
    regRef:    'Saudi FDA GMP Guidelines v2024  |  ICH Q7 Good Manufacturing Practice',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('Audit Overview', 30)
  p.field('Audit Type',   'Internal Compliance Audit')
  p.field('GMP Standard', 'Saudi FDA GMP Guidelines v2024  |  ICH Q7')
  p.field('Generated',    ts)
  p.bullet('GMP audit records are managed in TraceFlow. Log audit findings and observations to populate this report.')

  p.spacer(3)
  p.sectionTitle('GMP Requirement Areas', 80)
  p.table(
    ['Section', 'GMP Requirement Area', 'Status'],
    [
      ['Section 1', 'Personnel & Training',           'Not Assessed'],
      ['Section 2', 'Premises & Equipment',           'Not Assessed'],
      ['Section 3', 'Production Processes',           'Not Assessed'],
      ['Section 4', 'Quality Control Systems',        'Not Assessed'],
      ['Section 5', 'Documentation & Records',        'Not Assessed'],
      ['Section 6', 'Contract Manufacture & Testing', 'Not Assessed'],
      ['Section 7', 'Product Complaints & Recall',    'Not Assessed'],
      ['Section 8', 'Self-Inspection Program',        'Not Assessed'],
    ],
    [22, 100, 48]
  )

  p.spacer(3)
  p.sectionTitle('Non-Conformity Detail', 50)
  p.bullet('No non-conformities recorded. Log GMP audit findings in TraceFlow to populate this section.')

  p.spacer(3)
  p.sectionTitle('Re-Audit Schedule', 22)
  p.bullet('Schedule GMP re-audits via the SFDA module in TraceFlow.')

  return p.blob()
}

export function buildInspectionPackagePDF(ctx: ReportContext): Blob {
  const ts       = nowGregorian()
  const hash     = pdfHash()
  const date     = todayStr()
  const dateFlat = date.replace(/-/g, '')
  const p = new PDFDoc({
    title:     'SFDA Inspection Dossier',
    docNo:     `PKG-${dateFlat}`,
    version:   '1.0',
    generated: ts, hash,
    classif:   'CONFIDENTIAL — REGULATORY INSPECTION USE ONLY',
    regRef:    'Saudi FDA Establishment Inspection Procedure  |  GMP Guidelines v2024',
  })

  if (ctx.companyName) p.field('Facility', ctx.companyName)

  p.sectionTitle('Dossier Contents — SFDA Pre-Inspection Package', 80)
  p.table(
    ['#', 'Document Set', 'Scope'],
    [
      ['1', 'Batch History Records',      'See TraceFlow production module'],
      ['2', 'QC Inspection Reports',      'See TraceFlow QC module'],
      ['3', 'Traceability Chain Records', 'See TraceFlow batch & sales modules'],
      ['4', 'Recall Event Log',           'See TraceFlow recall module'],
      ['5', 'CAPA Register',              'See TraceFlow SFDA CAPA module'],
      ['6', 'Audit Trail',                'See TraceFlow activity log'],
      ['7', 'SFDA Inspection History',    'All prior inspections and outcomes on record'],
      ['8', 'Operator Activity Log',      'Full timestamped timeline with actor attribution'],
    ],
    [10, 90, 70]
  )

  p.spacer(3)
  p.sectionTitle('Compliance Scorecard', 46)
  p.scorecard([
    { label: 'Overall Compliance Score',   value: 'See TraceFlow', level: 'info' },
    { label: 'Inspection Readiness Score', value: 'See TraceFlow', level: 'info' },
    { label: 'Regulatory Risk Level',      value: 'See TraceFlow', level: 'info' },
    { label: 'Open CAPAs',                 value: 'See TraceFlow', level: 'info' },
  ])

  p.spacer(3)
  p.sectionTitle('Compliance Status by Domain', 44)
  p.statusRow('GMP Compliance Status',        'Not assessed — configure GMP audit module', 'partial')
  p.statusRow('Batch Traceability',           'See TraceFlow batch module',                'partial')
  p.statusRow('QC Documentation Status',      'See TraceFlow QC module',                  'partial')
  p.statusRow('Equipment Calibration Status', 'Not configured',                            'partial')

  p.spacer(3)
  p.sectionTitle('Corrective Actions Requiring Remediation', 38)
  p.bullet('No open CAPA actions on record. Add corrective actions via the CAPA module in TraceFlow.')

  return p.blob()
}

// ── ZIP builder ───────────────────────────────────────────────────────────────

export async function buildInspectionPackageZIP(ctx: ReportContext): Promise<Blob> {
  const date   = todayStr()
  const zip    = new JSZip()
  const folder = zip.folder('SFDA-Inspection-Dossier') ?? zip

  folder.file(`SFDA-Inspection-Dossier-${date}.pdf`,  buildInspectionPackagePDF(ctx))
  folder.file(`GMP-Audit-Report-${date}.pdf`,          buildGMPReportPDF(ctx))
  folder.file(`CAPA-Summary-Report-${date}.pdf`,       buildCAPAReportPDF(ctx))
  folder.file(`QC-Inspection-Report-${date}.pdf`,      buildQCReportPDF(ctx))
  folder.file(`Batch-Traceability-Report-${date}.pdf`, buildBatchReportPDF(ctx))
  folder.file(`NCR-Report-${date}.pdf`,                buildNCRReportPDF(ctx))
  folder.file(`Recall-Summary-Report-${date}.pdf`,     buildRecallReportPDF(ctx))

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' })
}
