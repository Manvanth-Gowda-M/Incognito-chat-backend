const ADJECTIVES = [
  "SILENT", "SECURE", "SHADOW", "CLOAKED", "VAULTED",
  "HIDDEN", "CRYPTO", "ROUTED", "DEEP", "BLIND",
  "MUTED", "ALPHA", "OMEGA", "STATIC", "DYNAMIC",
  "RANDOM", "GHOST", "PRISTINE", "Sleek", "MINIMAL"
];

const NOUNS = [
  "FOX", "WOLF", "ROOM", "NODE", "GATE", "KEY",
  "LINK", "CHAT", "PORT", "ZONE", "PATH", "CELL",
  "VAULT", "LOCK", "CORE", "MESH", "GRID", "LINE"
];

/**
 * Generates a high-entropy, human-friendly unique room code.
 * Example format: CLOAKED-VAULT-4821
 */
export function generateRoomCode(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)].toUpperCase();
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)].toUpperCase();
  const digits = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  
  return `${adj}-${noun}-${digits}`;
}
