// Cloudflare Workers type declarations
// These types are normally provided by @cloudflare/workers-types

export interface KVNamespace {
  get(key: string, options?: { type?: string; cacheTtl?: number }): Promise<string | undefined>;
  get(key: string, options: { type: 'json'; cacheTtl?: number }): Promise<any>;
  get(key: string, options: { type: 'arrayBuffer'; cacheTtl?: number }): Promise<ArrayBuffer>;
  get(key: string, options: { type: 'text'; cacheTtl?: number }): Promise<string>;
  get(key: string, options: { type: 'stream'; cacheTtl?: number }): Promise<ReadableStream>;
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expirationTtl?: number; metadata?: any }): Promise<void>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string; expiration?: number }>; list_complete: boolean; cursor?: string }>;
}

export interface R2Bucket {
  get(key: string, options?: { range?: { offset?: number; length?: number } }): Promise<R2ObjectBody | null>;
  head(key: string): Promise<R2Object | null>;
  put(key: string, value: ReadableStream | string | ArrayBuffer, options?: { httpMetadata?: R2HTTPMetadata; customMetadata?: Record<string, string>; sha256?: string }): Promise<R2PutResult>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string; delimiter?: string; cursor?: string; limit?: number }): Promise<R2ObjectBody[]>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  size: number;
  etag: string;
  httpMetadata: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2Object {
  key: string;
  size: number;
  etag: string;
  httpMetadata: R2HTTPMetadata;
  customMetadata?: Record<string, string>;
}

export interface R2PutResult {
  etag: string;
}

export interface R2HTTPMetadata {
  contentType?: string;
  contentEncoding?: string;
  contentLanguage?: string;
  contentDisposition?: string;
  contentLength?: number;
  cacheControl?: string;
  cacheExpiry?: Date;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  dump(): Promise<D1Result>;
  batch<T>(stmts: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: (string | number | boolean | null)[]): D1PreparedStatement;
  first<T = any>(column?: string): Promise<T>;
  all<T = any>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

export interface D1Result<T = any> {
  results: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, any>;
  count?: number;
  duration?: number;
  lastRowId?: number;
}

export interface ExecutionContext {
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
}

export interface RequestInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string | ReadableStream | ArrayBuffer;
  redirect?: 'follow' | 'error' | 'manual';
  cache?: 'default' | 'no-store' | 'reload' | 'no-cache' | 'force-cache' | 'only-if-cached';
  mode?: 'cors' | 'no-cors' | 'same-origin';
  credentials?: 'omit' | 'same-origin' | 'include';
  referrer?: string;
  referrerPolicy?: 'no-referrer' | 'no-referrer-when-downgrade' | 'same-origin' | 'origin' | 'strict-origin' | 'origin-when-cross-origin' | 'strict-origin-when-cross-origin' | 'unsafe-url';
  integrity?: string;
  keepalive?: boolean;
  signal?: AbortSignal;
}

export interface ResponseInit {
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
}