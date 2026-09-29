import {
  Product,
  ProductVariant,
  Inventory,
  Promotion,
  ProductFaq,
  KnowledgeDocument,
  KnowledgeRule,
  LiveSession,
  SellingScript,
  ScriptBlock,
  CustomerMessage,
  KnowledgeChunk,
} from './schema';

export const SEED_PRODUCTS: Product[] = [
  {
    id: 'prod-001',
    sku: 'SKU-001',
    name: 'Serum X – Brightening Booster',
    description: 'Serum pencerah konsentrat tinggi dengan Niacinamide 10% dan Alpha Arbutin. Mencerahkan kulit kusam, menyamarkan noda hitam bekas jerawat, dan meratakan warna kulit dalam 14 hari pemakaian rutin.',
    category: 'Skincare',
    base_price: 99000,
    sale_price: 79000,
    currency: 'IDR',
    status: 'ACTIVE',
    brand: 'Sari Glow Official',
    metadata: {
      bpom_number: 'NA18231900452',
      image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=500&auto=format&fit=crop&q=60',
      claims_approved: [
        'Mencerahkan kulit tampak lebih berseri dalam 14 hari',
        'Menyamarkan hiperpigmentasi dan noda hitam',
        'Teruji dermatologis cocok untuk kulit sensitif',
        'Tekstur ringan water-gel cepat meresap tanpa rasa lengket',
        'Sudah tersertifikasi BPOM dan Halal MUI'
      ],
      claims_restricted: [
        'Memutihkan kulit seketika secara instan',
        'Menghilangkan jerawat dan bopeng permanen 100%',
        'Mengobati penyakit kulit medis atau eksim kronis'
      ]
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prod-002',
    sku: 'SKU-002',
    name: 'Barrier Cream 5X Ceramide',
    description: 'Pelembap gel penyelamat skin barrier dengan 5 jenis Ceramide, Hyaluronic Acid, dan Centella Asiatica.',
    category: 'Skincare',
    base_price: 139000,
    sale_price: 119000,
    currency: 'IDR',
    status: 'ACTIVE',
    brand: 'Sari Glow Official',
    metadata: {
      bpom_number: 'NA18230104112',
      image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=500&auto=format&fit=crop&q=60',
      claims_approved: [
        'Memperbaiki skin barrier yang rusak',
        'Menghidrasi kulit hingga 24 jam',
        'Meredakan kemerahan dan iritasi ringan'
      ],
      claims_restricted: [
        'Menggantikan perawatan dokter kulit spesialis'
      ]
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prod-003',
    sku: 'SKU-003',
    name: 'Micellar Water Deep Clean 250ml',
    description: 'Pembersih wajah lembut tanpa bilas dengan teknologi micelle magnetik mengangkat waterproof makeup.',
    category: 'Cleanser',
    base_price: 65000,
    sale_price: 49000,
    currency: 'IDR',
    status: 'ACTIVE',
    brand: 'Sari Glow Official',
    metadata: {
      bpom_number: 'NA18221203491',
      image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=500&auto=format&fit=crop&q=60',
      claims_approved: [
        'Membersihkan kotoran dan riasan tanpa perih di mata',
        'Bebas alkohol dan parfum'
      ],
      claims_restricted: [
        'Menyembuhkan jerawat menahun'
      ]
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  },
  {
    id: 'prod-004',
    sku: 'SKU-004',
    name: 'Sunscreen Aqua UV Shield SPF 50+',
    description: 'Tabir surya hibrida ringan berbahan dasar air tanpa white cast dengan proteksi broad spectrum UV-A/UV-B.',
    category: 'Suncare',
    base_price: 89000,
    sale_price: 69000,
    currency: 'IDR',
    status: 'ACTIVE',
    brand: 'Sari Glow Official',
    metadata: {
      bpom_number: 'NA18231700982',
      image_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=500&auto=format&fit=crop&q=60',
      claims_approved: [
        'Melindungi kulit dari paparan sinar UV dan blue light',
        'Hasil akhir semi-matte bebas minyak'
      ],
      claims_restricted: [
        'Perlindungan 100% seumur hidup tanpa reaplikasi'
      ]
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }
];

export const SEED_VARIANTS: ProductVariant[] = [
  { id: 'var-001-a', product_id: 'prod-001', sku: 'SKU-001-20ML', variant_name: '20ml Travel Size', price: 79000, stock: 15, status: 'IN_STOCK' },
  { id: 'var-001-b', product_id: 'prod-001', sku: 'SKU-001-50ML', variant_name: '50ml Jumbo Pump', price: 149000, stock: 8, status: 'LOW_STOCK' },
  { id: 'var-002-a', product_id: 'prod-002', sku: 'SKU-002-30G', variant_name: '30g Jar', price: 119000, stock: 45, status: 'IN_STOCK' },
  { id: 'var-003-a', product_id: 'prod-003', sku: 'SKU-003-250ML', variant_name: '250ml Regular', price: 49000, stock: 12, status: 'IN_STOCK' },
  { id: 'var-004-a', product_id: 'prod-004', sku: 'SKU-004-50G', variant_name: '50g Tube', price: 69000, stock: 6, status: 'LOW_STOCK' }
];

export const SEED_INVENTORY: Inventory[] = [
  { sku: 'SKU-001', total_stock: 23, reserved_stock: 3, available_stock: 20, low_stock_threshold: 10, last_updated: new Date().toISOString() },
  { sku: 'SKU-002', total_stock: 45, reserved_stock: 5, available_stock: 40, low_stock_threshold: 15, last_updated: new Date().toISOString() },
  { sku: 'SKU-003', total_stock: 12, reserved_stock: 2, available_stock: 10, low_stock_threshold: 5, last_updated: new Date().toISOString() },
  { sku: 'SKU-004', total_stock: 6, reserved_stock: 0, available_stock: 6, low_stock_threshold: 10, last_updated: new Date().toISOString() }
];

export const SEED_PROMOTIONS: Promotion[] = [
  {
    id: 'promo-001',
    sku: 'SKU-001',
    title: 'Diskon Kilat 20% Live Exclusive',
    discount_percent: 20,
    active: true,
    start_time: '2026-09-28T00:00:00Z',
    end_time: '2026-09-30T23:59:59Z'
  },
  {
    id: 'promo-002',
    sku: 'SKU-002',
    title: 'Flash Sale Bundling Barrier',
    discount_percent: 15,
    active: true,
    start_time: '2026-09-28T00:00:00Z',
    end_time: '2026-09-30T23:59:59Z'
  }
];

export const SEED_FAQS: ProductFaq[] = [
  {
    id: 'faq-001',
    product_id: 'prod-001',
    sku: 'SKU-001',
    question: 'Apakah Serum X aman untuk ibu hamil dan menyusui?',
    answer: 'Serum X diformulasikan dengan Niacinamide dan Alpha Arbutin standar aman kosmetik BPOM. Namun untuk kenyamanan ekstra selama kehamilan, kami sarankan tetap berkonsultasi dengan dokter kandungan masing-masing.',
    category: 'Safety'
  },
  {
    id: 'faq-002',
    product_id: 'prod-001',
    sku: 'SKU-001',
    question: 'Kapan waktu terbaik menggunakan Serum X?',
    answer: 'Gunakan 2-3 tetes pada pagi dan malam hari setelah toner dan sebelum pelembap / sunscreen. Untuk hasil optimal, gunakan tabir surya di pagi hari.',
    category: 'Usage'
  },
  {
    id: 'faq-003',
    product_id: 'prod-001',
    sku: 'SKU-001',
    question: 'Bisa bayar COD dan pengiriman berapa lama?',
    answer: 'Bisa banget COD ke seluruh Indonesia via J&T dan SiCepat! Pesanan sebelum jam 16:00 WIB dikirim di hari yang sama dari gudang Jakarta Pusat.',
    category: 'Shipping'
  },
  {
    id: 'faq-004',
    product_id: 'prod-001',
    sku: 'SKU-001',
    question: 'Bagaimana kebijakan retur jika barang rusak atau pecah?',
    answer: 'Garansi ganti baru 100% gratis jika menyertakan video unboxing utuh tanpa jeda dalam kurun waktu 2x24 jam sejak paket diterima.',
    category: 'Return'
  }
];

export const SEED_DOCUMENTS: KnowledgeDocument[] = [
  {
    id: 'doc-001',
    title: 'Serum X Comprehensive Product Knowledge & Clinical Testing',
    category: 'Product Specs',
    content: 'Serum X Brightening Booster mengandung Niacinamide 10%, Alpha Arbutin 2%, Centella Asiatica, dan Hyaluronic Acid. Lolos uji dermatologi pada 100 panelis kulit Indonesia dengan tingkat kepuasan kecerahan 94% dalam 14 hari.',
    version: 'v2.1',
    indexed_at: new Date().toISOString()
  },
  {
    id: 'doc-002',
    title: 'Brand Policy & BPOM Health Claims Guardrails',
    category: 'Compliance',
    content: 'Sesuai regulasi BPOM dan etika siaran langsung e-commerce: DILARANG menjanjikan hasil instan seperti "putih dalam semalam", dilarang mengklaim menyembuhkan penyakit medis kulit, dilarang menyerang merk pesaing.',
    version: 'v1.4',
    indexed_at: new Date().toISOString()
  },
  {
    id: 'doc-003',
    title: 'Logistics, Shipping & COD Rules',
    category: 'Operations',
    content: 'Pengiriman setiap Senin-Sabtu. COD aktif untuk Pulau Jawa, Sumatera, Bali, Kalimantan, Sulawesi. Pengemasan bubble wrap 3 lapis tebal anti benturan.',
    version: 'v3.0',
    indexed_at: new Date().toISOString()
  }
];

export const SEED_RULES: KnowledgeRule[] = [
  {
    id: 'rule-001',
    rule_type: 'RESTRICTED_CLAIM',
    pattern: 'memutihkan|putih instan|sembuh total|pasti sembuh|menghilangkan permanen',
    replacement: 'mencerahkan kulit tampak berkilau dan menyamarkan noda secara bertahap',
    reason: 'BPOM & Platform Advertising Policy: Overpromising prohibited medical claims'
  },
  {
    id: 'rule-002',
    rule_type: 'APPROVED_CLAIM',
    pattern: 'mencerahkan|menyamarkan noda|merawat skin barrier|bpom|halal',
    reason: 'Approved clinical claim backed by certificates'
  }
];

export const SEED_SESSION: LiveSession = {
  id: 'LIVE-001',
  session_code: 'LIVE-2026-PAYDAY-01',
  title: 'Mega Flash Sale Sari Glow Official - Special Payday',
  platform: 'Dual',
  status: 'RUNNING',
  started_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  ended_at: null,
  current_product_id: 'prod-001',
  current_host_state: 'PROMO',
  current_script_id: 'script-001',
  current_script_block_id: 'sb-5',
  active_conversation_count: 3,
  platform_status: 'HEALTHY',
  last_heartbeat_at: new Date().toISOString(),
  last_successful_event_at: new Date().toISOString(),
  degraded_since: null,
  degraded_mode: 'NONE',
  created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  updated_at: new Date().toISOString(),

  is_ai_host_on: true,
  is_paused: false,
  is_muted: false,
  is_mic_takeover: false,
  current_sku: 'SKU-001',
  active_state: 'PROMO'
};

export const SEED_SCRIPTS: SellingScript[] = [
  {
    id: 'script-001',
    sku: 'SKU-001',
    title: 'High-Conversion Selling Script: Serum X',
    target_duration_sec: 120
  }
];

export const SEED_SCRIPT_BLOCKS: ScriptBlock[] = [
  { id: 'sb-1', script_id: 'script-001', step_name: 'HOOK', content: 'Kakak yang kulitnya kusam dan banyak bekas jerawat membandel, stop scroll sekarang juga!', duration_sec: 15, is_active: false },
  { id: 'sb-2', script_id: 'script-001', step_name: 'PROBLEM', content: 'Udah coba macam-macam skincare tapi wajah tetap kusam dan warna kulit nggak merata?', duration_sec: 20, is_active: false },
  { id: 'sb-3', script_id: 'script-001', step_name: 'SOLUTION', content: 'Kenalin Serum X Brightening Booster dengan Niacinamide 10% dan Alpha Arbutin murni!', duration_sec: 25, is_active: false },
  { id: 'sb-4', script_id: 'script-001', step_name: 'DEMO', content: 'Lihat teksturnya water-gel ringan banget, sekali oles langsung meresap dan nggak lengket sama sekali.', duration_sec: 20, is_active: false },
  { id: 'sb-5', script_id: 'script-001', step_name: 'PROMO', content: 'Khusus live hari ini dapat potongan 20%! Dari harga normal Rp99.000 jadi cuma Rp79.000 aja!', duration_sec: 20, is_active: true },
  { id: 'sb-6', script_id: 'script-001', step_name: 'CTA', content: 'Sisa stok tinggal 23 botol lagi kak, klik keranjang kuning nomor satu dan checkout sebelum kehabisan!', duration_sec: 20, is_active: false }
];

export const SEED_CHAT_MESSAGES: CustomerMessage[] = [
  {
    id: 'msg-001',
    conv_id: 'conv-001',
    author: 'Rina Sasmita',
    handle: '@rina_beauty',
    text: 'Kak ini harganya berapa dan promonya sampai jam berapa ya?',
    timestamp: 'Baru saja'
  },
  {
    id: 'msg-002',
    conv_id: 'conv-002',
    author: 'Budi Santoso',
    handle: '@budisantoso88',
    text: 'Bisa COD ke Surabaya nggak kak? Estimasi sampai kapan?',
    timestamp: '1 menit lalu'
  },
  {
    id: 'msg-003',
    conv_id: 'conv-003',
    author: 'Nadia Putri',
    handle: '@nadiaskincare',
    text: 'Buat kulit sensitif gampang merah aman gak min?',
    timestamp: '2 menit lalu'
  }
];
