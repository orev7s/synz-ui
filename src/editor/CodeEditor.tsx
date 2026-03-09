import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { OnMount, OnChange, loader } from '@monaco-editor/react';
import type * as Monaco from 'monaco-editor';
import { registerLuauLanguage, LUAU_LANGUAGE_ID } from './luauLanguage';
import { registerLuauCompletionProvider } from './luauCompletions';
import { registerLuauLspProviders } from './luauLsp';
import { registerGhostTextProvider } from './completions/ghostText';
import { loadUsageData } from './completions/usageTracker';
import { runDiagnostics } from './luauDiagnostics';
import { getSettings, subscribeToSettings, EditorSettings } from '../stores/settingsStore';
import { getQuickExecuteSettings, matchesKeybind } from '../stores/quickExecuteStore';
import { subscribeToNavigation } from '../stores/editorNavigationStore';

export interface EditorPosition {
  line: number;
  column: number;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onCursorChange?: (position: EditorPosition) => void;
  onExecute?: () => void;
  onSave?: () => void;
  readOnly?: boolean;
  fileId?: string;
  fileName?: string;
}

let isLanguageRegistered = false;

export function CodeEditor({ value, onChange, onCursorChange, onExecute, onSave, readOnly = false, fileId, fileName }: CodeEditorProps) {
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<typeof Monaco | null>(null);
  const [editorSettings, setEditorSettings] = useState<EditorSettings>(getSettings().editor);

  useEffect(() => {
    const unsubscribe = subscribeToSettings(() => {
      const newSettings = getSettings().editor;
      setEditorSettings(newSettings);
      if (editorRef.current) {
        editorRef.current.updateOptions({
          fontSize: newSettings.fontSize,
          tabSize: newSettings.tabSize,
          minimap: { enabled: newSettings.minimap },
          wordWrap: newSettings.wordWrap ? 'on' : 'off',
          lineNumbers: newSettings.lineNumbers ? 'on' : 'off',
          fontLigatures: newSettings.fontLigatures,
        });
      }
    });
    return unsubscribe;
  }, []);

  const handleEditorMount: OnMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    if (!isLanguageRegistered) {
      registerLuauLanguage(monaco);
      registerLuauCompletionProvider(monaco);
      registerLuauLspProviders(monaco);
      registerGhostTextProvider(monaco);
      loadUsageData();
      isLanguageRegistered = true;
    }

    monaco.editor.setTheme('synapsez-dark');

    editor.onDidChangeCursorPosition((e) => {
      if (onCursorChange) {
        onCursorChange({
          line: e.position.lineNumber,
          column: e.position.column,
        });
      }
    });

    editor.onKeyDown((e) => {
      const settings = getQuickExecuteSettings();
      const keyEvent = e.browserEvent;

      if (onExecute && matchesKeybind(keyEvent, settings.executeKeybind)) {
        e.preventDefault();
        e.stopPropagation();
        onExecute();
      }

      if (onSave && matchesKeybind(keyEvent, settings.saveKeybind)) {
        e.preventDefault();
        e.stopPropagation();
        onSave();
      }
    });

    const model = editor.getModel();
    if (model && fileId && fileName) {
      runDiagnostics(monaco, model, fileId, fileName);
    }

    editor.focus();
  }, [onCursorChange, fileId, fileName]);

  const handleChange: OnChange = useCallback((newValue) => {
    if (newValue !== undefined) {
      onChange(newValue);

      if (monacoRef.current && editorRef.current && fileId && fileName) {
        const model = editorRef.current.getModel();
        if (model) {
          runDiagnostics(monacoRef.current, model, fileId, fileName);
        }
      }
    }
  }, [onChange, fileId, fileName]);

  useEffect(() => {
    loader.init().then((monaco) => {
      if (!isLanguageRegistered) {
        registerLuauLanguage(monaco);
        registerLuauCompletionProvider(monaco);
        registerGhostTextProvider(monaco);
        loadUsageData();
        isLanguageRegistered = true;
      }
    });
  }, []);

  useEffect(() => {
    if (editorRef.current) {
      const position = editorRef.current.getPosition();
      if (position && onCursorChange) {
        onCursorChange({
          line: position.lineNumber,
          column: position.column,
        });
      }
    }
  }, [value, onCursorChange]);

  useEffect(() => {
    const targetId = fileId;
    if (!targetId) return;

    return subscribeToNavigation((request) => {
      if (request.fileId !== targetId || !editorRef.current) return;
      const editor = editorRef.current;
      editor.revealLineInCenter(request.line);
      editor.setPosition({ lineNumber: request.line, column: request.column });
      editor.focus();
    });
  }, [fileId]);

  return (
    <Editor
      height="100%"
      language={LUAU_LANGUAGE_ID}
      value={value}
      onChange={handleChange}
      onMount={handleEditorMount}
      theme="synapsez-dark"
      options={{
        fontSize: editorSettings.fontSize,
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
        fontLigatures: editorSettings.fontLigatures,
        lineHeight: 20,
        tabSize: editorSettings.tabSize,
        insertSpaces: true,
        minimap: {
          enabled: editorSettings.minimap,
          side: 'right',
          size: 'proportional',
          showSlider: 'mouseover',
          renderCharacters: false,
          maxColumn: 80,
        },
        scrollBeyondLastLine: false,
        wordWrap: editorSettings.wordWrap ? 'on' : 'off',
        lineNumbers: editorSettings.lineNumbers ? 'on' : 'off',
        renderLineHighlight: 'line',
        cursorBlinking: 'smooth',
        cursorSmoothCaretAnimation: 'on',
        smoothScrolling: true,
        padding: { top: 10, bottom: 10 },
        readOnly,
        automaticLayout: true,
        suggestOnTriggerCharacters: true,
        quickSuggestions: true,
        parameterHints: { enabled: true },
        suggest: {
          showKeywords: true,
          showSnippets: true,
          showFunctions: true,
          showVariables: true,
          showClasses: true,
          showModules: true,
          showProperties: true,
          showMethods: true,
          showConstants: true,
          snippetsPreventQuickSuggestions: false,
          filterGraceful: false,
        },
        acceptSuggestionOnEnter: 'smart',
        acceptSuggestionOnCommitCharacter: false,
        bracketPairColorization: { enabled: true },
        autoClosingBrackets: 'always',
        autoClosingQuotes: 'always',
        autoIndent: 'full',
        formatOnPaste: true,
        formatOnType: true,
        folding: true,
        foldingStrategy: 'indentation',
        showFoldingControls: 'mouseover',
        matchBrackets: 'always',
        occurrencesHighlight: 'singleFile',
        renderWhitespace: 'selection',
        guides: {
          indentation: true,
          bracketPairs: true,
        },
      }}
    />
  );
}
