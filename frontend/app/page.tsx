'use client';

import React, { useState, useRef, useEffect } from 'react';
import { chat, ingestDirectory, ingestUpload, ingestRepo, type ChatResponse, type Source } from './lib/api';
import CodeModal from './components/CodeModal';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  sources?: Source[];
  timestamp: Date;
}

interface FileReference {
  filename: string;
  lineNumber: number;
  code?: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [model, setModel] = useState('deepseek');
  const [isLoading, setIsLoading] = useState(false);
  const [ingestPath, setIngestPath] = useState('');
  const [repoUrl, setRepoUrl] = useState('');
  const [ingestMethod, setIngestMethod] = useState<'path' | 'upload' | 'repo'>('path');
  const [isIngesting, setIsIngesting] = useState(false);
  const [ingestStatus, setIngestStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<FileReference | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const parseFileReferences = (text: string): FileReference[] => {
    // Regex to match filename.ext:line_number format
    const regex = /(\w+[-.\w]*\.(?:js|ts|py|tsx|jsx|jsx?)):(\d+)/g;
    const matches: FileReference[] = [];
    let match;

    while ((match = regex.exec(text)) !== null) {
      matches.push({
        filename: match[1],
        lineNumber: parseInt(match[2], 10),
      });
    }

    return matches;
  };

  const renderMessageContent = (content: string, messageIndex: number) => {
    // Preprocess content to convert file references to special markdown links
    // This allows us to render them as clickable buttons
    const fileRefRegex = /(\w+[-.\w]*\.(?:js|ts|py|tsx|jsx|jsx?):\d+)/g;
    const processedContent = content.replace(fileRefRegex, (match) => {
      return `[${match}](file://${match})`;
    });

    return (
      <div className="prose prose-sm dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            // Customize code blocks
            code({ node, inline, className, children, ...props }: any) {
              const codeString = String(children).replace(/\n$/, '');
              
              return !inline ? (
                <pre className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 overflow-x-auto my-2">
                  <code className={className} {...props}>
                    {codeString}
                  </code>
                </pre>
              ) : (
                <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm" {...props}>
                  {codeString}
                </code>
              );
            },
            // Customize links - handle file references specially
            a({ href, children, ...props }: any) {
              // Check if this is a file reference link
              if (href && href.startsWith('file://')) {
                const fileRef = href.replace('file://', '');
                const [filename, lineNumberStr] = fileRef.split(':');
                const lineNumber = parseInt(lineNumberStr, 10);
                
                return (
                  <button
                    onClick={() => {
                      const message = messages[messageIndex];
                      const source = message?.sources?.find(
                        (s) =>
                          s.filename === filename &&
                          s.start_line === lineNumber
                      );
                      setSelectedFile({
                        filename,
                        lineNumber,
                        code: source?.preview || 'Code snippet not available',
                      });
                    }}
                    className="font-mono text-blue-600 dark:text-blue-400 hover:underline px-1 py-0.5 rounded bg-blue-50 dark:bg-blue-950/50 mx-0.5 cursor-pointer"
                  >
                    {children}
                  </button>
                );
              }
              
              // Regular links
              return (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                  {...props}
                >
                  {children}
                </a>
              );
            },
            // Customize paragraphs
            p({ children }: any) {
              return <p className="my-2">{children}</p>;
            },
            // Customize list items
            li({ children }: any) {
              return <li className="my-1">{children}</li>;
            },
            // Customize headings
            h1({ children }: any) {
              return <h1 className="text-2xl font-bold mt-4 mb-2">{children}</h1>;
            },
            h2({ children }: any) {
              return <h2 className="text-xl font-bold mt-3 mb-2">{children}</h2>;
            },
            h3({ children }: any) {
              return <h3 className="text-lg font-bold mt-2 mb-1">{children}</h3>;
            },
            // Customize blockquotes
            blockquote({ children }: any) {
              return (
                <blockquote className="border-l-4 border-zinc-300 dark:border-zinc-600 pl-4 my-2 italic">
                  {children}
                </blockquote>
              );
            },
          }}
        >
          {processedContent}
        </ReactMarkdown>
      </div>
    );
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response: ChatResponse = await chat(input, model);
      const assistantMessage: Message = {
        role: 'assistant',
        content: response.response,
        sources: response.sources,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Failed to get response'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleIngest = async () => {
    if (isIngesting) return;

    setIsIngesting(true);
    setIngestStatus('Ingesting codebase...');

    try {
      let response;
      
      if (ingestMethod === 'path') {
        if (!ingestPath.trim()) {
          throw new Error('Please enter a directory path');
        }
        response = await ingestDirectory(ingestPath);
        setIngestPath('');
      } else if (ingestMethod === 'repo') {
        if (!repoUrl.trim()) {
          throw new Error('Please enter a repository URL');
        }
        response = await ingestRepo(repoUrl);
        setRepoUrl('');
      } else {
        throw new Error('Please select a file to upload');
      }
      
      setIngestStatus(
        `Success! Processed ${response.files_processed} files, created ${response.chunks_created} chunks.`
      );
    } catch (error) {
      setIngestStatus(
        `Error: ${error instanceof Error ? error.message : 'Failed to ingest codebase'}`
      );
    } finally {
      setIsIngesting(false);
      setTimeout(() => setIngestStatus(null), 5000);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.zip')) {
      setIngestStatus('Error: Only ZIP files are supported');
      setTimeout(() => setIngestStatus(null), 5000);
      return;
    }

    setIsIngesting(true);
    setIngestStatus('Uploading and ingesting codebase...');

    try {
      const response = await ingestUpload(file);
      setIngestStatus(
        `Success! Processed ${response.files_processed} files, created ${response.chunks_created} chunks.`
      );
    } catch (error) {
      setIngestStatus(
        `Error: ${error instanceof Error ? error.message : 'Failed to upload and ingest file'}`
      );
    } finally {
      setIsIngesting(false);
      setTimeout(() => setIngestStatus(null), 5000);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex min-h-screen bg-zinc-50 dark:bg-black">
      {/* Main Chat Area */}
      <div className="flex flex-col w-full max-w-4xl mx-auto bg-white dark:bg-zinc-900 shadow-lg">
        {/* Header */}
        <div className="border-b border-zinc-200 dark:border-zinc-800 p-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mb-4">
            Codebase RAG Chat
          </h1>
          
          {/* Model Selector and Ingest Section */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Model:
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                disabled={isLoading}
              >
                <option value="deepseek">DeepSeek</option>
                <option value="chatgpt">ChatGPT</option>
              </select>
            </div>

            {/* Ingest Section */}
            <div className="flex flex-col gap-3">
              {/* Tabs */}
              <div className="flex gap-2 border-b border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={() => setIngestMethod('path')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    ingestMethod === 'path'
                      ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  disabled={isIngesting}
                >
                  Local Path
                </button>
                <button
                  onClick={() => setIngestMethod('upload')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    ingestMethod === 'upload'
                      ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  disabled={isIngesting}
                >
                  Upload ZIP
                </button>
                <button
                  onClick={() => setIngestMethod('repo')}
                  className={`px-4 py-2 text-sm font-medium transition-colors ${
                    ingestMethod === 'repo'
                      ? 'border-b-2 border-blue-600 text-blue-600 dark:text-blue-400'
                      : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
                  }`}
                  disabled={isIngesting}
                >
                  GitHub Repo
                </button>
              </div>

              {/* Content based on selected tab */}
              {ingestMethod === 'path' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ingestPath}
                    onChange={(e) => setIngestPath(e.target.value)}
                    placeholder="Enter local directory path (e.g., C:\Users\...\project)"
                    className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleIngest();
                      }
                    }}
                    disabled={isIngesting}
                  />
                  <button
                    onClick={handleIngest}
                    disabled={isIngesting || !ingestPath.trim()}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isIngesting ? 'Ingesting...' : 'Ingest'}
                  </button>
                </div>
              )}

              {ingestMethod === 'upload' && (
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".zip"
                    onChange={handleFileUpload}
                    className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm file:mr-4 file:py-1 file:px-2 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-zinc-700 dark:file:text-zinc-200"
                    disabled={isIngesting}
                  />
                  {isIngesting && (
                    <span className="text-sm text-zinc-600 dark:text-zinc-400">Uploading...</span>
                  )}
                </div>
              )}

              {ingestMethod === 'repo' && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={repoUrl}
                    onChange={(e) => setRepoUrl(e.target.value)}
                    placeholder="Enter GitHub repo URL or owner/repo (e.g., https://github.com/user/repo or user/repo)"
                    className="flex-1 px-3 py-1.5 border border-zinc-300 dark:border-zinc-700 rounded bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        handleIngest();
                      }
                    }}
                    disabled={isIngesting}
                  />
                  <button
                    onClick={handleIngest}
                    disabled={isIngesting || !repoUrl.trim()}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {isIngesting ? 'Cloning...' : 'Clone & Ingest'}
                  </button>
                </div>
              )}
            </div>
            {ingestStatus && (
              <div
                className={`text-sm ${
                  ingestStatus.startsWith('Error')
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-green-600 dark:text-green-400'
                }`}
              >
                {ingestStatus}
              </div>
            )}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <div className="text-center text-zinc-500 dark:text-zinc-400 mt-8">
              <p>Start a conversation with your codebase!</p>
              <p className="text-sm mt-2">
                First, ingest a directory of code files, then ask questions.
              </p>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100'
                }`}
              >
                {message.role === 'user' ? (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                ) : (
                  renderMessageContent(message.content, index)
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.1s' }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0.2s' }}
                  ></div>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 p-4">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask a question about your codebase..."
              className="flex-1 px-4 py-2 border border-zinc-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {/* Code Modal */}
      {selectedFile && (
        <CodeModal
          filename={selectedFile.filename}
          lineNumber={selectedFile.lineNumber}
          code={selectedFile.code || 'Code snippet not available'}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}