import { getServiceClassName, getMemberValueType, isKnownClass } from './robloxClasses';

export interface ScopeVariable {
  name: string;
  inferredType: string | null;
  line: number;
  isParam: boolean;
}

const GET_SERVICE_PATTERN = /local\s+(\w+)\s*=\s*game\s*:\s*GetService\s*\(\s*["'](\w+)["']\s*\)/g;
const LOCAL_ASSIGN_PATTERN = /local\s+(\w+)\s*=\s*(.+)/g;
const FUNCTION_PARAM_PATTERN = /(?:local\s+)?function\s+\w*\s*\(([^)]*)\)/g;
const FOR_LOOP_PATTERN = /for\s+(\w+(?:\s*,\s*\w+)*)\s+in/g;

const BLOCK_START = /\b(function|if|for|while|do|repeat)\b/g;
const BLOCK_END = /\b(end|until)\b/g;

function findBlockDepthAtLine(lines: string[], targetLine: number): number {
  let depth = 0;
  for (let i = 0; i < targetLine && i < lines.length; i++) {
    const line = lines[i];
    const starts = (line.match(BLOCK_START) || []).length;
    const ends = (line.match(BLOCK_END) || []).length;
    depth += starts - ends;
  }
  return Math.max(0, depth);
}

function inferTypeFromExpression(expr: string, existingVars: ScopeVariable[]): string | null {
  const trimmed = expr.trim();

  const getServiceMatch = trimmed.match(/^game\s*:\s*GetService\s*\(\s*["'](\w+)["']\s*\)/);
  if (getServiceMatch) {
    return getServiceClassName(getServiceMatch[1]) ?? null;
  }

  const instanceNewMatch = trimmed.match(/^Instance\s*\.\s*new\s*\(\s*["'](\w+)["']\s*\)/);
  if (instanceNewMatch) {
    return isKnownClass(instanceNewMatch[1]) ? instanceNewMatch[1] : null;
  }

  const chainMatch = trimmed.match(/^(\w+)([.:]\w+)*$/);
  if (chainMatch) {
    const parts = trimmed.split(/[.:]/);
    if (parts.length >= 2) {
      const rootName = parts[0];
      const rootVar = existingVars.find(v => v.name === rootName);

      if (rootVar?.inferredType) {
        let currentType: string | null = rootVar.inferredType;
        for (let i = 1; i < parts.length && currentType; i++) {
          currentType = getMemberValueType(currentType, parts[i]);
        }
        return currentType;
      }
    }

    const singleVar = existingVars.find(v => v.name === parts[0]);
    if (singleVar?.inferredType && parts.length === 1) {
      return singleVar.inferredType;
    }
  }

  const findChildOfClassMatch = trimmed.match(/\w+\s*:\s*FindFirstChildOfClass\s*\(\s*["'](\w+)["']\s*\)/);
  if (findChildOfClassMatch) {
    return isKnownClass(findChildOfClassMatch[1]) ? findChildOfClassMatch[1] : null;
  }

  const findChildWhichIsAMatch = trimmed.match(/\w+\s*:\s*FindFirstChildWhichIsA\s*\(\s*["'](\w+)["']\s*\)/);
  if (findChildWhichIsAMatch) {
    return isKnownClass(findChildWhichIsAMatch[1]) ? findChildWhichIsAMatch[1] : null;
  }

  if (/\w+\s*:\s*Clone\s*\(\s*\)/.test(trimmed)) {
    const sourceMatch = trimmed.match(/^(\w+)\s*:/);
    if (sourceMatch) {
      const sourceVar = existingVars.find(v => v.name === sourceMatch[1]);
      return sourceVar?.inferredType ?? null;
    }
  }

  return null;
}

export function analyzeScope(text: string, cursorLine: number): ScopeVariable[] {
  const lines = text.split('\n');
  const variables: ScopeVariable[] = [];
  const targetDepth = findBlockDepthAtLine(lines, cursorLine);

  variables.push(
    { name: 'game', inferredType: 'DataModel', line: 0, isParam: false },
    { name: 'workspace', inferredType: 'Workspace', line: 0, isParam: false },
    { name: 'script', inferredType: 'Script', line: 0, isParam: false },
  );

  for (let i = 0; i < cursorLine && i < lines.length; i++) {
    const line = lines[i];

    let gsMatch;
    GET_SERVICE_PATTERN.lastIndex = 0;
    while ((gsMatch = GET_SERVICE_PATTERN.exec(line)) !== null) {
      const varName = gsMatch[1];
      const serviceName = gsMatch[2];
      const serviceType = getServiceClassName(serviceName);
      variables.push({
        name: varName,
        inferredType: serviceType,
        line: i,
        isParam: false,
      });
    }

    LOCAL_ASSIGN_PATTERN.lastIndex = 0;
    let localMatch;
    while ((localMatch = LOCAL_ASSIGN_PATTERN.exec(line)) !== null) {
      const varName = localMatch[1];
      if (variables.some(v => v.name === varName && v.line === i)) continue;
      const expr = localMatch[2].replace(/\s*--.*$/, '').trim();
      const inferredType = inferTypeFromExpression(expr, variables);
      variables.push({
        name: varName,
        inferredType,
        line: i,
        isParam: false,
      });
    }

    FUNCTION_PARAM_PATTERN.lastIndex = 0;
    let funcMatch;
    while ((funcMatch = FUNCTION_PARAM_PATTERN.exec(line)) !== null) {
      const params = funcMatch[1].split(',').map(p => p.trim().split(':')[0].trim()).filter(Boolean);
      const currentDepth = findBlockDepthAtLine(lines, i);
      if (currentDepth <= targetDepth) {
        for (const param of params) {
          variables.push({
            name: param,
            inferredType: null,
            line: i,
            isParam: true,
          });
        }
      }
    }

    FOR_LOOP_PATTERN.lastIndex = 0;
    let forMatch;
    while ((forMatch = FOR_LOOP_PATTERN.exec(line)) !== null) {
      const vars = forMatch[1].split(',').map(v => v.trim()).filter(Boolean);
      for (const v of vars) {
        variables.push({
          name: v,
          inferredType: null,
          line: i,
          isParam: false,
        });
      }
    }
  }

  return variables;
}

export function inferExpressionType(expression: string, variables: ScopeVariable[]): string | null {
  return inferTypeFromExpression(expression, variables);
}

export function resolveChainType(chain: string, variables: ScopeVariable[]): string | null {
  const parts = chain.split(/[.:]/);
  if (parts.length === 0) return null;

  const rootName = parts[0];

  const rootVar = variables.find(v => v.name === rootName);
  if (!rootVar?.inferredType) {
    const serviceType = getServiceClassName(rootName);
    if (serviceType) {
      let currentType: string | null = serviceType;
      for (let i = 1; i < parts.length && currentType; i++) {
        currentType = getMemberValueType(currentType, parts[i]);
      }
      return currentType;
    }
    return null;
  }

  let currentType: string | null = rootVar.inferredType;
  for (let i = 1; i < parts.length && currentType; i++) {
    currentType = getMemberValueType(currentType, parts[i]);
  }
  return currentType;
}
