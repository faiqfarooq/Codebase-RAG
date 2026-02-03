const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export interface IngestRequest {
  directory_path: string;
}

export interface IngestResponse {
  message: string;
  files_processed: number;
  chunks_created: number;
}

export interface ChatRequest {
  query: string;
  model?: string;
}

export interface Source {
  filename: string;
  start_line: number;
  file_type: string;
  preview: string;
}

export interface ChatResponse {
  response: string;
  sources: Source[];
}

export async function ingestDirectory(path: string): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/ingest`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ directory_path: path }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to ingest directory');
  }

  return response.json();
}

export async function ingestUpload(file: File): Promise<IngestResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${API_BASE_URL}/ingest/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to upload and ingest file');
  }

  return response.json();
}

export async function ingestRepo(repoUrl: string): Promise<IngestResponse> {
  const response = await fetch(`${API_BASE_URL}/ingest/repo`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ repo_url: repoUrl }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to ingest repository');
  }

  return response.json();
}

export async function chat(query: string, model: string = 'deepseek'): Promise<ChatResponse> {
  const response = await fetch(`${API_BASE_URL}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, model }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to get chat response');
  }

  return response.json();
}