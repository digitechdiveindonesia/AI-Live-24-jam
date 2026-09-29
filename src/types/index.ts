export interface ProductItem {
  id: string;
  sku: string;
  title: string;
  brand: string;
  category: string;
  basePrice: number;
  strikePrice: number | null;
  promoBadge: string | null;
  totalStock: number;
  isLowStock: boolean;
  isOutOfStock: boolean;
  isOnAir: boolean;
  variants: { name: string; stock: number }[];
  bpomNumber: string;
  imageUrl: string;
  syncStatus: string;
}

export interface BroadcastSession {
  id: string;
  title: string;
  runtime: string;
  viewers: number;
  gmv: string;
  orders: number;
  isLive: boolean;
  isAiHostOn: boolean;
  isMuted: boolean;
  isPaused: boolean;
  isMicTakeover: boolean;
  activeState: string;
  liveTranscript: string;
}

export interface LiveChatMessage {
  id: string;
  author: string;
  handle: string;
  platform: 'TikTok' | 'Shopee';
  text: string;
  time: string;
  intent: string;
  intentConfidence: number;
  verifiedSku: string;
  guardrailStatus: 'APPROVED' | 'MODIFIED' | 'BLOCKED';
  aiReply: string;
  latencyMs: number;
}
