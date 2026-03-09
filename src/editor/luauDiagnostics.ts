import type * as Monaco from 'monaco-editor';
import { setDiagnostics, DiagnosticSeverity } from '../stores/diagnosticStore';

interface ParsedDiagnostic {
  severity: DiagnosticSeverity;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

const KEYWORDS = new Set([
  'and', 'break', 'do', 'else', 'elseif', 'end', 'false', 'for', 'function',
  'if', 'in', 'local', 'nil', 'not', 'or', 'repeat', 'return', 'then',
  'true', 'until', 'while', 'continue', 'export', 'type',
]);

interface Token {
  type: 'keyword' | 'identifier' | 'string' | 'number' | 'operator' | 'punctuation' | 'comment' | 'eof';
  value: string;
  line: number;
  column: number;
}

function tokenize(code: string): Token[] {
  const tokens: Token[] = [];
  let line = 1;
  let column = 1;
  let i = 0;

  const advance = (count = 1) => {
    for (let j = 0; j < count && i < code.length; j++) {
      if (code[i] === '\n') {
        line++;
        column = 1;
      } else {
        column++;
      }
      i++;
    }
  };

  const skipWhitespace = () => {
    while (i < code.length && /\s/.test(code[i])) {
      advance();
    }
  };

  while (i < code.length) {
    skipWhitespace();
    if (i >= code.length) break;

    const startLine = line;
    const startColumn = column;
    const char = code[i];
    const next = code[i + 1];

    if (char === '-' && next === '-') {
      advance(2);
      if (code[i] === '[' && code[i + 1] === '[') {
        advance(2);
        while (i < code.length && !(code[i] === ']' && code[i + 1] === ']')) {
          advance();
        }
        advance(2);
      } else {
        while (i < code.length && code[i] !== '\n') {
          advance();
        }
      }
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      advance();
      let value = quote;
      while (i < code.length && code[i] !== quote) {
        if (code[i] === '\\') {
          value += code[i];
          advance();
          if (i < code.length) {
            value += code[i];
            advance();
          }
        } else if (code[i] === '\n') {
          tokens.push({ type: 'string', value, line: startLine, column: startColumn });
          break;
        } else {
          value += code[i];
          advance();
        }
      }
      if (i < code.length && code[i] === quote) {
        value += quote;
        advance();
      }
      tokens.push({ type: 'string', value, line: startLine, column: startColumn });
      continue;
    }

    if (char === '[' && next === '[') {
      advance(2);
      let value = '[[';
      while (i < code.length && !(code[i] === ']' && code[i + 1] === ']')) {
        value += code[i];
        advance();
      }
      value += ']]';
      advance(2);
      tokens.push({ type: 'string', value, line: startLine, column: startColumn });
      continue;
    }

    if (/[a-zA-Z_]/.test(char)) {
      let value = '';
      while (i < code.length && /[a-zA-Z0-9_]/.test(code[i])) {
        value += code[i];
        advance();
      }
      const type = KEYWORDS.has(value) ? 'keyword' : 'identifier';
      tokens.push({ type, value, line: startLine, column: startColumn });
      continue;
    }

    if (/[0-9]/.test(char) || (char === '.' && next && /[0-9]/.test(next))) {
      let value = '';
      if (char === '0' && (next === 'x' || next === 'X')) {
        value += code[i];
        advance();
        value += code[i];
        advance();
        while (i < code.length && /[0-9a-fA-F]/.test(code[i])) {
          value += code[i];
          advance();
        }
      } else if (char === '0' && (next === 'b' || next === 'B')) {
        value += code[i];
        advance();
        value += code[i];
        advance();
        while (i < code.length && /[01]/.test(code[i])) {
          value += code[i];
          advance();
        }
      } else {
        while (i < code.length && /[0-9]/.test(code[i])) {
          value += code[i];
          advance();
        }
        if (code[i] === '.' && /[0-9]/.test(code[i + 1])) {
          value += code[i];
          advance();
          while (i < code.length && /[0-9]/.test(code[i])) {
            value += code[i];
            advance();
          }
        }
        if (code[i] === 'e' || code[i] === 'E') {
          value += code[i];
          advance();
          if (code[i] === '+' || code[i] === '-') {
            value += code[i];
            advance();
          }
          while (i < code.length && /[0-9]/.test(code[i])) {
            value += code[i];
            advance();
          }
        }
      }
      tokens.push({ type: 'number', value, line: startLine, column: startColumn });
      continue;
    }

    const multiCharOps = ['==', '~=', '<=', '>=', '..', '::', '+=', '-=', '*=', '/=', '..='];
    let matched = false;
    for (const op of multiCharOps) {
      if (code.substring(i, i + op.length) === op) {
        tokens.push({ type: 'operator', value: op, line: startLine, column: startColumn });
        advance(op.length);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    if ('+-*/%^#<>='.includes(char)) {
      tokens.push({ type: 'operator', value: char, line: startLine, column: startColumn });
      advance();
      continue;
    }

    if ('(){}[];:,.'.includes(char)) {
      tokens.push({ type: 'punctuation', value: char, line: startLine, column: startColumn });
      advance();
      continue;
    }

    advance();
  }

  tokens.push({ type: 'eof', value: '', line, column });
  return tokens;
}

function analyzeSyntax(code: string): ParsedDiagnostic[] {
  const diagnostics: ParsedDiagnostic[] = [];
  const tokens = tokenize(code);
  const lines = code.split('\n');

  let blockStack: { keyword: string; line: number; column: number }[] = [];
  let parenDepth = 0;
  let braceDepth = 0;
  let bracketDepth = 0;
  let parenStack: { line: number; column: number }[] = [];
  let braceStack: { line: number; column: number }[] = [];
  let bracketStack: { line: number; column: number }[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    const prev = tokens[i - 1];
    const next = tokens[i + 1];

    if (token.type === 'punctuation') {
      if (token.value === '(') {
        parenDepth++;
        parenStack.push({ line: token.line, column: token.column });
      } else if (token.value === ')') {
        parenDepth--;
        parenStack.pop();
        if (parenDepth < 0) {
          diagnostics.push({
            severity: 'error',
            message: 'Unexpected closing parenthesis',
            line: token.line,
            column: token.column,
          });
          parenDepth = 0;
        }
      } else if (token.value === '{') {
        braceDepth++;
        braceStack.push({ line: token.line, column: token.column });
      } else if (token.value === '}') {
        braceDepth--;
        braceStack.pop();
        if (braceDepth < 0) {
          diagnostics.push({
            severity: 'error',
            message: 'Unexpected closing brace',
            line: token.line,
            column: token.column,
          });
          braceDepth = 0;
        }
      } else if (token.value === '[') {
        bracketDepth++;
        bracketStack.push({ line: token.line, column: token.column });
      } else if (token.value === ']') {
        bracketDepth--;
        bracketStack.pop();
        if (bracketDepth < 0) {
          diagnostics.push({
            severity: 'error',
            message: 'Unexpected closing bracket',
            line: token.line,
            column: token.column,
          });
          bracketDepth = 0;
        }
      }
    }

    if (token.type === 'keyword') {
      if (token.value === 'function' || token.value === 'if') {
        blockStack.push({ keyword: token.value, line: token.line, column: token.column });
      } else if (token.value === 'for' || token.value === 'while') {
        blockStack.push({ keyword: token.value, line: token.line, column: token.column });
      } else if (token.value === 'do') {
        const lastBlock = blockStack[blockStack.length - 1];
        if (lastBlock && (lastBlock.keyword === 'while' || lastBlock.keyword === 'for')) {
        } else if (prev?.value !== 'end') {
          blockStack.push({ keyword: 'do', line: token.line, column: token.column });
        }
      } else if (token.value === 'repeat') {
        blockStack.push({ keyword: 'repeat', line: token.line, column: token.column });
      } else if (token.value === 'end') {
        if (blockStack.length === 0) {
          diagnostics.push({
            severity: 'error',
            message: 'Unexpected \'end\' without matching block',
            line: token.line,
            column: token.column,
          });
        } else {
          const block = blockStack.pop()!;
          if (block.keyword === 'repeat') {
            diagnostics.push({
              severity: 'error',
              message: '\'repeat\' block should end with \'until\', not \'end\'',
              line: token.line,
              column: token.column,
            });
          }
        }
      } else if (token.value === 'until') {
        if (blockStack.length === 0) {
          diagnostics.push({
            severity: 'error',
            message: 'Unexpected \'until\' without matching \'repeat\'',
            line: token.line,
            column: token.column,
          });
        } else {
          const block = blockStack.pop()!;
          if (block.keyword !== 'repeat') {
            diagnostics.push({
              severity: 'error',
              message: `'until' does not match '${block.keyword}'`,
              line: token.line,
              column: token.column,
            });
            blockStack.push(block);
          }
        }
      }
    }

    if (token.type === 'identifier' && prev) {
      if (prev.type === 'punctuation' && prev.value === ')' && token.line === prev.line) {
        diagnostics.push({
          severity: 'error',
          message: `Unexpected identifier '${token.value}' after ')'`,
          line: token.line,
          column: token.column,
          endColumn: token.column + token.value.length,
        });
      }
      if (prev.type === 'string' && token.line === prev.line) {
        diagnostics.push({
          severity: 'error',
          message: `Unexpected identifier '${token.value}' after string`,
          line: token.line,
          column: token.column,
          endColumn: token.column + token.value.length,
        });
      }
      if (prev.type === 'number' && token.line === prev.line) {
        diagnostics.push({
          severity: 'error',
          message: `Unexpected identifier '${token.value}' after number`,
          line: token.line,
          column: token.column,
          endColumn: token.column + token.value.length,
        });
      }
    }

    if (token.type === 'string') {
      if ((token.value.startsWith('"') && !token.value.endsWith('"')) ||
          (token.value.startsWith("'") && !token.value.endsWith("'"))) {
        diagnostics.push({
          severity: 'error',
          message: 'Unterminated string',
          line: token.line,
          column: token.column,
        });
      }
    }

    if (token.value === ';' && next && next.type !== 'eof') {
      if (next.type === 'identifier' || next.type === 'keyword') {
      } else if (next.value === ';') {
        diagnostics.push({
          severity: 'warning',
          message: 'Unnecessary semicolon',
          line: token.line,
          column: token.column,
        });
      }
    }

    if (token.type === 'keyword' && token.value === 'then') {
      if (!blockStack.some(b => b.keyword === 'if')) {
        diagnostics.push({
          severity: 'error',
          message: '\'then\' without matching \'if\'',
          line: token.line,
          column: token.column,
        });
      }
    }
  }

  for (const block of blockStack) {
    if (block.keyword === 'repeat') {
      diagnostics.push({
        severity: 'error',
        message: `Unclosed '${block.keyword}' - expected 'until'`,
        line: block.line,
        column: block.column,
      });
    } else {
      diagnostics.push({
        severity: 'error',
        message: `Unclosed '${block.keyword}' - expected 'end'`,
        line: block.line,
        column: block.column,
      });
    }
  }

  if (parenDepth > 0) {
    const unclosed = parenStack[parenStack.length - 1];
    if (unclosed) {
      diagnostics.push({
        severity: 'error',
        message: 'Unclosed parenthesis',
        line: unclosed.line,
        column: unclosed.column,
      });
    }
  }

  if (braceDepth > 0) {
    const unclosed = braceStack[braceStack.length - 1];
    if (unclosed) {
      diagnostics.push({
        severity: 'error',
        message: 'Unclosed brace',
        line: unclosed.line,
        column: unclosed.column,
      });
    }
  }

  if (bracketDepth > 0) {
    const unclosed = bracketStack[bracketStack.length - 1];
    if (unclosed) {
      diagnostics.push({
        severity: 'error',
        message: 'Unclosed bracket',
        line: unclosed.line,
        column: unclosed.column,
      });
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.includes('= =') && !trimmed.includes('==')) {
      const col = line.indexOf('= =') + 1;
      diagnostics.push({
        severity: 'error',
        message: 'Use \'==\' for comparison, not \'= =\'',
        line: i + 1,
        column: col,
      });
    }

    const assignInCondition = trimmed.match(/^(if|while|elseif)\s+.*[^=<>~!]=[^=]/);
    if (assignInCondition && !trimmed.includes('==') && !trimmed.includes('~=') && !trimmed.includes('<=') && !trimmed.includes('>=')) {
      const eqIndex = line.indexOf('=', line.indexOf(assignInCondition[1]));
      if (eqIndex !== -1 && line[eqIndex + 1] !== '=' && line[eqIndex - 1] !== '=' &&
          line[eqIndex - 1] !== '<' && line[eqIndex - 1] !== '>' && line[eqIndex - 1] !== '~') {
        diagnostics.push({
          severity: 'warning',
          message: 'Possible assignment in condition - did you mean \'==\'?',
          line: i + 1,
          column: eqIndex + 1,
        });
      }
    }
  }

  return diagnostics;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function runDiagnostics(
  monaco: typeof Monaco,
  model: Monaco.editor.ITextModel,
  fileId: string,
  fileName: string
): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    const code = model.getValue();
    const parsed = analyzeSyntax(code);

    const markers: Monaco.editor.IMarkerData[] = parsed.map((d) => ({
      severity: d.severity === 'error'
        ? monaco.MarkerSeverity.Error
        : d.severity === 'warning'
          ? monaco.MarkerSeverity.Warning
          : monaco.MarkerSeverity.Info,
      message: d.message,
      startLineNumber: d.line,
      startColumn: d.column,
      endLineNumber: d.endLine || d.line,
      endColumn: d.endColumn || d.column + 1,
    }));

    monaco.editor.setModelMarkers(model, 'luau', markers);

    setDiagnostics(fileId, fileName, parsed);
  }, 300);
}

export function clearModelDiagnostics(monaco: typeof Monaco, model: Monaco.editor.ITextModel): void {
  monaco.editor.setModelMarkers(model, 'luau', []);
}
