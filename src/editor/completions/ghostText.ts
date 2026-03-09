import type * as Monaco from 'monaco-editor';
import { LUAU_LANGUAGE_ID } from '../luauLanguage';
import { getServiceClassName } from './robloxClasses';

interface PatternRule {
  trigger: RegExp;
  suggest: (match: RegExpMatchArray, lineContent: string) => string | null;
}

const SERVICE_NAMES = [
  'Players', 'Workspace', 'ReplicatedStorage', 'ReplicatedFirst',
  'ServerStorage', 'ServerScriptService', 'StarterGui', 'StarterPack',
  'StarterPlayer', 'Lighting', 'SoundService', 'TweenService',
  'RunService', 'UserInputService', 'ContextActionService', 'HttpService',
  'MarketplaceService', 'DataStoreService', 'MessagingService',
  'TeleportService', 'TextService', 'PathfindingService',
  'PhysicsService', 'CollectionService', 'Debris', 'Chat', 'Teams',
  'MemoryStoreService',
];

const PATTERN_RULES: PatternRule[] = [
  {
    trigger: /^local\s+(\w+)\s*=\s*$/,
    suggest: (match) => {
      const varName = match[1];
      if (SERVICE_NAMES.includes(varName)) {
        return `game:GetService("${varName}")`;
      }
      if (varName === 'player' || varName === 'plr') {
        return 'game:GetService("Players").LocalPlayer';
      }
      if (varName === 'character' || varName === 'char') {
        return 'game:GetService("Players").LocalPlayer.Character';
      }
      if (varName === 'mouse') {
        return 'game:GetService("Players").LocalPlayer:GetMouse()';
      }
      if (varName === 'camera' || varName === 'cam') {
        return 'workspace.CurrentCamera';
      }
      return null;
    },
  },
  {
    trigger: /^local\s+(\w+)\s*=\s*game\s*:\s*GetService\s*\(\s*["'](\w+)["']\s*\)\s*$/,
    suggest: (match) => {
      const serviceName = match[2];
      if (serviceName === 'Players') {
        return '\nlocal player = Players.LocalPlayer';
      }
      return null;
    },
  },
  {
    trigger: /(\w+)\.PlayerAdded:Connect\(function\(\s*$/,
    suggest: () => 'player)\n\t\nend)',
  },
  {
    trigger: /(\w+)\.CharacterAdded:Connect\(function\(\s*$/,
    suggest: () => 'character)\n\t\nend)',
  },
  {
    trigger: /(\w+)\.(Heartbeat|RenderStepped|Stepped):Connect\(function\(\s*$/,
    suggest: () => 'deltaTime)\n\t\nend)',
  },
  {
    trigger: /(\w+)\.InputBegan:Connect\(function\(\s*$/,
    suggest: () => 'input, gameProcessed)\n\tif gameProcessed then return end\n\t\nend)',
  },
  {
    trigger: /^\s*for\s+\w+\s*,\s*\w+\s+in\s+pairs\(\w+\)\s+do\s*$/,
    suggest: () => '\n\t\nend',
  },
  {
    trigger: /^\s*if\s+.+\s+then\s*$/,
    suggest: () => '\n\t\nend',
  },
  {
    trigger: /^local\s+success,\s*\w+\s*=\s*pcall\(function\(\)\s*$/,
    suggest: () => '\n\t\nend)',
  },
  {
    trigger: /^\s*while\s+.+\s+do\s*$/,
    suggest: () => '\n\t\nend',
  },
];

export function registerGhostTextProvider(monaco: typeof Monaco): Monaco.IDisposable {
  return monaco.languages.registerInlineCompletionsProvider(LUAU_LANGUAGE_ID, {
    provideInlineCompletions(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);
      const textBeforeCursor = lineContent.substring(0, position.column - 1);
      const items: Monaco.languages.InlineCompletion[] = [];

      for (const rule of PATTERN_RULES) {
        const match = textBeforeCursor.match(rule.trigger);
        if (match) {
          const suggestion = rule.suggest(match, lineContent);
          if (suggestion) {
            items.push({
              insertText: suggestion,
              range: {
                startLineNumber: position.lineNumber,
                startColumn: position.column,
                endLineNumber: position.lineNumber,
                endColumn: position.column,
              },
            });
            break;
          }
        }
      }

      return { items };
    },
    disposeInlineCompletions() {},
  });
}

export function getServiceAutoLocalSnippet(serviceName: string): string | null {
  if (!getServiceClassName(serviceName)) return null;
  return `local ${serviceName} = game:GetService("${serviceName}")`;
}
