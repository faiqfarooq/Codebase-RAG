'use client';

import { useEffect } from 'react';

interface CodeModalProps {
  filename: string;
  lineNumber: number;
  code: string;
  onClose: () => void;
}

export default function CodeModal({ filename, lineNumber, code, onClose }: CodeModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(`${filename}:${lineNumber}\n\n${code}`);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-lg shadow-xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-zinc-900 dark:text-zinc-100">
              {filename}
            </span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              :{lineNumber}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>

        {/* Code Content */}
        <div className="flex-1 overflow-auto p-4">
          <pre className="font-mono text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">
            <code>{code}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}