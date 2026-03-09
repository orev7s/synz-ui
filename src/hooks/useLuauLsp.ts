import { useEffect, useRef, useCallback } from 'react';
import type * as Monaco from 'monaco-editor';
import {
  isLspAvailable,
  startLsp,
  openDocument,
  updateDocument,
  closeDocument,
  fileIdToUri,
} from '../services/lspClient';
import { runDiagnostics } from '../editor/luauDiagnostics';

interface UseLuauLspOptions {
  monaco: typeof Monaco | null;
  model: Monaco.editor.ITextModel | null;
  fileId: string;
  fileName: string;
  content: string;
}

export function useLuauLsp({ monaco, model, fileId, fileName, content }: UseLuauLspOptions) {
  const lspAvailable = useRef(false);
  const documentOpen = useRef(false);
  const lastUri = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const available = await isLspAvailable();
      if (!mounted) return;

      lspAvailable.current = available;

      if (available) {
        await startLsp();
      }
    }

    init();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!fileId || !fileName) return;

    const uri = fileIdToUri(fileId, fileName);

    async function openDoc() {
      if (lspAvailable.current && content) {
        if (lastUri.current && lastUri.current !== uri) {
          await closeDocument(lastUri.current);
        }

        await openDocument(uri, content);
        documentOpen.current = true;
        lastUri.current = uri;
      }
    }

    openDoc();

    return () => {
      if (documentOpen.current && lastUri.current) {
        closeDocument(lastUri.current);
        documentOpen.current = false;
      }
    };
  }, [fileId, fileName]);

  const handleContentChange = useCallback(
    async (newContent: string) => {
      if (!fileId || !fileName) return;

      const uri = fileIdToUri(fileId, fileName);

      if (lspAvailable.current && documentOpen.current) {
        await updateDocument(uri, newContent);
      }

      if (monaco && model) {
        runDiagnostics(monaco, model, fileId, fileName);
      }
    },
    [monaco, model, fileId, fileName]
  );

  return {
    handleContentChange,
    isLspAvailable: lspAvailable.current,
  };
}
