import React, { useState } from 'react';
import { ProductItem } from '../types';
import { Drawer } from '../components/Drawer';

interface ProductsPageProps {
  products: ProductItem[];
  onSelectProduct: (product: ProductItem) => void;
  onUpdateStock: (sku: string, newStock: number) => void;
}

export const ProductsPage: React.FC<ProductsPageProps> = ({
  products,
  onSelectProduct,
  onUpdateStock
}) => {
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  const handleRowClick = (prod: ProductItem) => {
    setSelectedProduct(prod);
    onSelectProduct(prod);
  };

  return (
    <div className="p-8 max-w-[1440px] mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Product Catalog</h2>
          <p className="text-xs text-slate-400">Authoritative Commerce Database & Stock Source of Truth</p>
        </div>
        <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-3 py-1 rounded-lg border border-cyan-800">
          {products.length} Active SKUs
        </span>
      </div>

      {/* Main Commerce Table (Clean, 5 Essential Columns) */}
      <div className="bg-[#111827] border border-[#1E293B] rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#1E293B] bg-slate-900/60 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
              <th className="py-3.5 px-6">Product</th>
              <th className="py-3.5 px-6">Price</th>
              <th className="py-3.5 px-6">Promo</th>
              <th className="py-3.5 px-6">Stock</th>
              <th className="py-3.5 px-6">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800 text-xs">
            {products.map((prod) => (
              <tr
                key={prod.id}
                onClick={() => handleRowClick(prod)}
                className="hover:bg-slate-800/40 cursor-pointer transition-colors"
              >
                {/* 1. Product */}
                <td className="py-4 px-6 flex items-center gap-3">
                  <img
                    src={prod.imageUrl}
                    alt={prod.title}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700 shrink-0"
                  />
                  <div>
                    <div className="font-semibold text-slate-200">{prod.title}</div>
                    <div className="text-[11px] text-slate-400 font-mono">{prod.sku}</div>
                  </div>
                </td>

                {/* 2. Price */}
                <td className="py-4 px-6">
                  <div className="font-bold text-slate-100 font-mono">
                    Rp{prod.basePrice.toLocaleString('id-ID')}
                  </div>
                  {prod.strikePrice && (
                    <div className="text-[11px] text-slate-400 line-through font-mono">
                      Rp{prod.strikePrice.toLocaleString('id-ID')}
                    </div>
                  )}
                </td>

                {/* 3. Promo */}
                <td className="py-4 px-6">
                  {prod.promoBadge ? (
                    <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      {prod.promoBadge}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </td>

                {/* 4. Stock */}
                <td className="py-4 px-6 font-mono">
                  <span className={`font-semibold ${
                    prod.totalStock <= 10 ? 'text-amber-400' : 'text-slate-200'
                  }`}>
                    {prod.totalStock} pcs
                  </span>
                </td>

                {/* 5. Status */}
                <td className="py-4 px-6">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium ${
                    prod.isOnAir
                      ? 'bg-red-500/10 text-red-400 border border-red-500/30'
                      : 'bg-slate-800 text-slate-300'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${prod.isOnAir ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
                    {prod.isOnAir ? 'ON AIR' : 'READY'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* DETAIL DRAWER (Progressive Disclosure) */}
      <Drawer
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        title={selectedProduct?.title || 'Product Details'}
        subtitle={`SKU: ${selectedProduct?.sku} | BPOM: ${selectedProduct?.bpomNumber}`}
      >
        {selectedProduct && (
          <div className="space-y-5 text-xs">
            <img
              src={selectedProduct.imageUrl}
              alt={selectedProduct.title}
              className="w-full h-44 object-cover rounded-xl border border-slate-700"
            />

            <div>
              <span className="text-slate-400 font-medium">Brand & Category</span>
              <div className="text-sm font-semibold text-slate-200 mt-0.5">
                {selectedProduct.brand} • {selectedProduct.category}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 p-3 bg-slate-900 rounded-xl border border-slate-800">
              <div>
                <span className="text-slate-400 text-[11px]">Selling Price</span>
                <div className="text-base font-bold text-emerald-400 font-mono">
                  Rp{selectedProduct.basePrice.toLocaleString('id-ID')}
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Current Stock</span>
                <div className="text-base font-bold text-amber-400 font-mono">
                  {selectedProduct.totalStock} units
                </div>
              </div>
            </div>

            {/* Inventory Adjustment Action */}
            <div className="space-y-2">
              <span className="text-slate-400 font-medium">Operator Stock Adjustment</span>
              <div className="flex gap-2">
                <button
                  onClick={() => onUpdateStock(selectedProduct.sku, Math.max(0, selectedProduct.totalStock - 5))}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  -5 pcs
                </button>
                <button
                  onClick={() => onUpdateStock(selectedProduct.sku, selectedProduct.totalStock + 10)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded border border-slate-700"
                >
                  +10 pcs
                </button>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-medium">Product Variants</span>
              <div className="mt-1.5 space-y-1">
                {selectedProduct.variants.map((v, i) => (
                  <div key={i} className="p-2 bg-slate-900/60 rounded flex justify-between text-slate-300 border border-slate-800">
                    <span>{v.name}</span>
                    <span className="font-mono text-cyan-400">{v.stock} pcs</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
