/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;
  readonly VITE_LAB_SERVER_PORT?: string;
  /** e.g. ws://127.0.0.1:3001 — overrides host/port logic for the lab WebSocket */
  readonly VITE_LAB_WS_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
