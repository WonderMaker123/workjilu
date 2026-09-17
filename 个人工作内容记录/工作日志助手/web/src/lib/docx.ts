// Markdown → 标准 .docx（OOXML）导出
// 使用 docx 库在浏览器端生成；本模块通过动态 import 按需加载，不影响首屏
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type ISectionOptions,
  type ITableBordersOptions,
} from 'docx';
import { Lexer } from 'marked';

// 中文字体约定：正文宋体、标题黑体
const FONT_BODY = { ascii: 'Times New Roman', hAnsi: 'Times New Roman', eastAsia: '宋体' };
const FONT_HEAD = { ascii: 'Arial', hAnsi: 'Arial', eastAsia: '黑体' };
const FONT_MONO = { ascii: 'Consolas', hAnsi: 'Consolas', eastAsia: '宋体' };

const COLOR_MUTED = '555555';
const COLOR_LINK = '0563C1';
const ORDERED_REF = 'decimal-list';

type AnyToken = any;

interface RunStyle {
  bold?: boolean;
  italics?: boolean;
  color?: string;
  size?: number;
}

// inline token → TextRun[]，样式可被 strong/em 覆盖
function inlineRuns(tokens: AnyToken[] | undefined, style: RunStyle = {}): TextRun[] {
  const runs: TextRun[] = [];
  for (const t of tokens || []) {
    switch (t.type) {
      case 'text':
      case 'escape':
        runs.push(new TextRun({ text: t.text, font: FONT_BODY, size: 28, ...style }));
        break;
      case 'strong':
        runs.push(...inlineRuns(t.tokens, { ...style, bold: true }));
        break;
      case 'em':
        runs.push(...inlineRuns(t.tokens, { ...style, italics: true }));
        break;
      case 'codespan':
        runs.push(new TextRun({ text: t.text, font: FONT_MONO, size: style.size ?? 24, color: '333333', bold: style.bold, italics: style.italics }));
        break;
      case 'br':
        runs.push(new TextRun({ break: 1 }));
        break;
      case 'del':
        runs.push(new TextRun({ text: inlineText(t.tokens), strike: true, font: FONT_BODY, size: 28, ...style }));
        break;
      case 'link':
        runs.push(new TextRun({ text: inlineText(t.tokens), color: COLOR_LINK, underline: {}, font: FONT_BODY, size: 28 }));
        break;
      default:
        if (typeof t.text === 'string') {
          runs.push(new TextRun({ text: t.text, font: FONT_BODY, size: 28, ...style }));
        }
    }
  }
  return runs;
}

function inlineText(tokens: AnyToken[] | undefined): string {
  return (tokens || []).map((t) => ('tokens' in t ? inlineText(t.tokens) : t.text ?? '')).join('');
}

interface BlockCtx {
  quote?: boolean;
  listLevel?: number;
  runStyle?: RunStyle;
}

// 普通正文段落（1.5 倍行距）
function bodyParagraph(tokens: AnyToken[] | undefined, ctx: BlockCtx = {}): Paragraph {
  return new Paragraph({
    spacing: { line: 360, lineRule: 'auto', after: 80 },
    ...(ctx.quote
      ? { indent: { left: 360 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'BBBBBB', space: 8 } } }
      : {}),
    children: inlineRuns(tokens, { color: ctx.quote ? COLOR_MUTED : undefined, size: 28, ...ctx.runStyle }),
  });
}

// block token → (Paragraph | Table)[]
function blockNodes(tokens: AnyToken[], ctx: BlockCtx = {}): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  const level = ctx.listLevel ?? 0;

  for (const tok of tokens) {
    switch (tok.type) {
      case 'heading': {
        const depth = tok.depth as number;
        const heading = depth >= 3 ? HeadingLevel.HEADING_3 : depth === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_1;
        const size = depth === 1 ? 32 : depth === 2 ? 30 : 28; // 16pt / 15pt / 14pt
        out.push(new Paragraph({
          heading,
          alignment: depth === 1 ? AlignmentType.CENTER : AlignmentType.LEFT,
          spacing: { before: depth === 1 ? 120 : 240, after: 120, line: 360, lineRule: 'auto' },
          children: [new TextRun({ text: tok.text, bold: true, font: FONT_HEAD, size, color: '111111' })],
        }));
        break;
      }
      case 'paragraph':
      case 'text':
        out.push(bodyParagraph(tok.tokens, ctx));
        break;
      case 'blockquote': {
        // 抬头已含部门，跳过正文里重复的「部门：…」引用行
        if (/^部门[：:]/.test((tok.text || '').trim())) break;
        out.push(...blockNodes(tok.tokens, { ...ctx, quote: true }));
        break;
      }
      case 'list':
        for (const item of tok.items as AnyToken[]) out.push(...listItemNodes(item, tok.ordered, level, ctx));
        break;
      case 'code':
        out.push(new Paragraph({
          spacing: { line: 300, lineRule: 'auto', after: 80 },
          shading: { type: 'clear', fill: 'F5F5F5' },
          children: String(tok.text || '').split('\n').flatMap((line: string, i: number) =>
            i === 0
              ? [new TextRun({ text: line, font: FONT_MONO, size: 22 })]
              : [new TextRun({ break: 1, text: line, font: FONT_MONO, size: 22 })]),
        }));
        break;
      case 'hr':
        out.push(new Paragraph({
          spacing: { before: 80, after: 80 },
          border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: 'DDDDDD', space: 1 } },
          children: [new TextRun({ text: '' })],
        }));
        break;
      case 'table':
        out.push(tableNode(tok));
        break;
      case 'space':
      case 'html':
        break;
      default:
        if (Array.isArray(tok.tokens)) out.push(...blockNodes(tok.tokens, ctx));
        else if (typeof tok.text === 'string') out.push(bodyParagraph([{ type: 'text', text: tok.text }], ctx));
    }
  }
  return out;
}

// 列表项：首行为列表段落，嵌套 list 递归缩进
function listItemNodes(item: AnyToken, ordered: boolean, level: number, ctx: BlockCtx): Array<Paragraph | Table> {
  const out: Array<Paragraph | Table> = [];
  for (const sub of item.tokens || []) {
    if (sub.type === 'list') {
      for (const child of sub.items as AnyToken[]) out.push(...listItemNodes(child, sub.ordered, level + 1, ctx));
    } else if (sub.type === 'text' || sub.type === 'paragraph') {
      out.push(new Paragraph({
        spacing: { line: 340, lineRule: 'auto', after: 40 },
        ...(ordered
          ? { numbering: { reference: ORDERED_REF, level } }
          : { bullet: { level } }),
        children: inlineRuns(sub.tokens, { size: 28, ...ctx.runStyle }),
      }));
    } else {
      out.push(...blockNodes([sub], { ...ctx, listLevel: level }));
    }
  }
  return out;
}

const TABLE_BORDERS: ITableBordersOptions = {
  top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  left: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  right: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' },
  insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
  insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD' },
};

function tableNode(tok: AnyToken): Table {
  const toRow = (cells: AnyToken[], header: boolean) => new TableRow({
    tableHeader: header,
    children: cells.map((cell) => new TableCell({
      ...(header ? { shading: { type: 'clear', fill: 'F5F5F5' } } : {}),
      children: blockNodes(cell.tokens || [{ type: 'text', text: cell.text || '' }], { runStyle: { size: 24, bold: header } }),
    })),
  });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: TABLE_BORDERS,
    rows: [toRow(tok.header || [], true), ...(tok.rows || []).map((r: AnyToken[]) => toRow(r, false))],
  });
}

export interface DocxHeader {
  company: string;
  department?: string;
}

/** 把 Markdown 汇报内容生成为标准 .docx 的 Blob */
export async function markdownToDocxBlob(markdown: string, header: DocxHeader): Promise<Blob> {
  const bodyNodes = blockNodes(Lexer.lex(markdown));

  const headerNodes: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 60 },
      children: [new TextRun({ text: header.company, bold: true, font: FONT_HEAD, size: 40, color: '111111' })], // 20pt
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [new TextRun({ text: header.department || '', font: FONT_BODY, size: 24, color: '444444' })], // 12pt
    }),
  ];

  const section: ISectionOptions = {
    properties: {
      page: {
        size: { width: 11906, height: 16838 }, // A4（twips）
        margin: { top: 1247, right: 1134, bottom: 1247, left: 1134 }, // 约 2.2cm / 2cm
      },
    },
    children: [...headerNodes, ...bodyNodes],
  };

  const doc = new Document({
    creator: header.company,
    title: '工作汇报',
    styles: { default: { document: { run: { font: FONT_BODY, size: 28 } } } },
    numbering: {
      config: [{
        reference: ORDERED_REF,
        levels: [0, 1, 2].map((lvl) => ({
          level: lvl,
          format: LevelFormat.DECIMAL,
          text: `%${lvl + 1}.`,
          alignment: AlignmentType.START,
          style: { paragraph: { indent: { left: 420 + lvl * 420, hanging: 420 } } },
        })),
      }],
    },
    sections: [section],
  });

  return Packer.toBlob(doc);
}
