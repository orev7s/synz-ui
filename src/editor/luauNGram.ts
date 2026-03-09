import type * as Monaco from 'monaco-editor';

export type NGramSource = 'ngram' | 'identifier';

export interface NGramSuggestion {
  label: string;
  score: number;
  source: NGramSource;
}

export interface NGramConfig {
  maxSuggestions: number;
  minPrefixLength: number;
  maxContextTokens: number;
  ngramOrder: 2 | 3;
}

interface ModelCache {
  versionId: number;
  unigram: Map<string, number>;
  bigram: Map<string, Map<string, number>>;
  trigram: Map<string, Map<string, number>>;
  identifiers: Map<string, number>;
}

const STOPWORDS = new Set([
  'and',
  'break',
  'do',
  'else',
  'elseif',
  'end',
  'false',
  'for',
  'function',
  'if',
  'in',
  'local',
  'nil',
  'not',
  'or',
  'repeat',
  'return',
  'then',
  'true',
  'until',
  'while',
]);

const modelCache = new WeakMap<Monaco.editor.ITextModel, ModelCache>();

function stripLuau(text: string): string {
  let output = '';
  let index = 0;

  while (index < text.length) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '-' && next === '-') {
      const isBlock = text[index + 2] === '[' && text[index + 3] === '[';
      if (isBlock) {
        index += 4;
        while (index < text.length && !(text[index] === ']' && text[index + 1] === ']')) {
          index += 1;
        }
        index += 2;
        continue;
      }

      index += 2;
      while (index < text.length && text[index] !== '\n') {
        index += 1;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      index += 1;
      while (index < text.length) {
        if (text[index] === '\\') {
          index += 2;
          continue;
        }
        if (text[index] === quote) {
          index += 1;
          break;
        }
        index += 1;
      }
      continue;
    }

    if (char === '[' && next === '[') {
      index += 2;
      while (index < text.length && !(text[index] === ']' && text[index + 1] === ']')) {
        index += 1;
      }
      index += 2;
      continue;
    }

    output += char;
    index += 1;
  }

  return output;
}

function tokenize(text: string): string[] {
  const stripped = stripLuau(text);
  const tokens = stripped.match(/[A-Za-z_][A-Za-z0-9_]*/g);
  return tokens ?? [];
}

function addCount(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function addNext(
  map: Map<string, Map<string, number>>,
  key: string,
  next: string,
): void {
  let nextMap = map.get(key);
  if (!nextMap) {
    nextMap = new Map();
    map.set(key, nextMap);
  }
  nextMap.set(next, (nextMap.get(next) ?? 0) + 1);
}

function buildCache(text: string, versionId: number): ModelCache {
  const tokens = tokenize(text);
  const unigram = new Map<string, number>();
  const bigram = new Map<string, Map<string, number>>();
  const trigram = new Map<string, Map<string, number>>();

  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    addCount(unigram, token);

    if (i >= 1) {
      addNext(bigram, tokens[i - 1], token);
    }

    if (i >= 2) {
      const key = `${tokens[i - 2]}\u0001${tokens[i - 1]}`;
      addNext(trigram, key, token);
    }
  }

  const identifiers = new Map<string, number>();
  for (const [token, count] of unigram.entries()) {
    if (!STOPWORDS.has(token)) {
      identifiers.set(token, count);
    }
  }

  return {
    versionId,
    unigram,
    bigram,
    trigram,
    identifiers,
  };
}

function getCache(model: Monaco.editor.ITextModel): ModelCache {
  const versionId = model.getVersionId();
  const cached = modelCache.get(model);
  if (cached && cached.versionId === versionId) {
    return cached;
  }

  const text = model.getValue();
  const nextCache = buildCache(text, versionId);
  modelCache.set(model, nextCache);
  return nextCache;
}

function getContextTokens(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition,
  maxTokens: number,
): string[] {
  const startLine = Math.max(1, position.lineNumber - 3);
  const range: Monaco.IRange = {
    startLineNumber: startLine,
    startColumn: 1,
    endLineNumber: position.lineNumber,
    endColumn: position.column,
  };
  const nearby = model.getValueInRange(range);
  const tokens = tokenize(nearby);
  return tokens.slice(-maxTokens);
}

function matchesPrefix(token: string, prefix: string): { matches: boolean; exactCase: boolean } {
  if (!prefix) {
    return { matches: false, exactCase: false };
  }
  if (token.startsWith(prefix)) {
    return { matches: true, exactCase: true };
  }
  if (token.toLowerCase().startsWith(prefix.toLowerCase())) {
    return { matches: true, exactCase: false };
  }
  return { matches: false, exactCase: false };
}

function scoreCandidate(token: string, count: number, prefix: string, boost: number): number {
  const match = matchesPrefix(token, prefix);
  if (!match.matches) {
    return 0;
  }

  let score = count + boost;
  if (match.exactCase) {
    score += 5;
  } else {
    score += 2;
  }

  if (token.length <= prefix.length + 2) {
    score += 1;
  }

  return score;
}

function pickTopSuggestions(
  candidates: Map<string, number>,
  prefix: string,
  source: NGramSource,
  boost: number,
): NGramSuggestion[] {
  const suggestions: NGramSuggestion[] = [];
  for (const [token, count] of candidates.entries()) {
    if (STOPWORDS.has(token)) {
      continue;
    }
    const score = scoreCandidate(token, count, prefix, boost);
    if (score <= 0) {
      continue;
    }
    suggestions.push({ label: token, score, source });
  }
  return suggestions;
}

export function getNGramSuggestions(
  model: Monaco.editor.ITextModel,
  position: Monaco.IPosition,
  prefix: string,
  config: NGramConfig,
): NGramSuggestion[] {
  if (prefix.length < config.minPrefixLength) {
    return [];
  }

  const cache = getCache(model);
  const contextTokens = getContextTokens(model, position, config.maxContextTokens);
  const suggestions: NGramSuggestion[] = [];

  if (config.ngramOrder >= 3 && contextTokens.length >= 2) {
    const key = `${contextTokens[contextTokens.length - 2]}\u0001${contextTokens[contextTokens.length - 1]}`;
    const nextMap = cache.trigram.get(key);
    if (nextMap) {
      suggestions.push(...pickTopSuggestions(nextMap, prefix, 'ngram', 12));
    }
  }

  if (suggestions.length === 0 && contextTokens.length >= 1) {
    const key = contextTokens[contextTokens.length - 1];
    const nextMap = cache.bigram.get(key);
    if (nextMap) {
      suggestions.push(...pickTopSuggestions(nextMap, prefix, 'ngram', 8));
    }
  }

  if (suggestions.length === 0) {
    suggestions.push(...pickTopSuggestions(cache.unigram, prefix, 'ngram', 4));
  }

  suggestions.push(...pickTopSuggestions(cache.identifiers, prefix, 'identifier', 2));

  const merged = new Map<string, NGramSuggestion>();
  for (const suggestion of suggestions) {
    const existing = merged.get(suggestion.label);
    if (!existing || suggestion.score > existing.score) {
      merged.set(suggestion.label, suggestion);
    }
  }

  return Array.from(merged.values())
    .sort((a, b) => b.score - a.score || a.label.localeCompare(b.label))
    .slice(0, config.maxSuggestions);
}
