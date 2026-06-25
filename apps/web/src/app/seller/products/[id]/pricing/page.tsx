'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RouteGuard } from '@/components/RouteGuard';
import { DashboardLayout } from '@/components/DashboardLayout';
import { getSellerMenuItems } from '@/lib/sellerMenu';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/useToast';
import { useCurrency } from '@/contexts/CurrencyContext';
import Link from 'next/link';

interface Tier {
  id?: string;
  minQuantity: number;
  price: number;
}

export default function ProductVolumePricingPage() {
  const params = useParams();
  const productId = params.id as string;
  const toast = useToast();
  const { formatPrice } = useCurrency();
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [loading, setLoading] = useState(true);
  const [minQty, setMinQty] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const menuItems = getSellerMenuItems(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getVolumePricing(productId);
        if (!cancelled && res?.data) {
          setTiers(Array.isArray(res.data) ? res.data : []);
        }
      } catch {
        if (!cancelled) setTiers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [productId]);

  const addTier = async () => {
    const minQuantity = parseInt(minQty, 10);
    const price = parseFloat(tierPrice);
    if (!minQuantity || minQuantity < 1 || !price || price <= 0) {
      toast.error('Enter valid min quantity and price');
      return;
    }
    try {
      const res = await apiClient.createVolumePricing(productId, {
        minQuantity,
        price,
        discountType: 'FIXED',
        discountValue: 0,
      });
      if (res?.data) {
        setTiers((prev) => [...prev, res.data]);
        setMinQty('');
        setTierPrice('');
        toast.success('Tier added');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to add tier');
    }
  };

  return (
    <RouteGuard allowedRoles={['B2C_SELLER', 'SELLER', 'WHOLESALER', 'ADMIN']} showAccessDenied>
      <DashboardLayout role="SELLER" menuItems={menuItems} title="Volume pricing">
        <div className="mb-4">
          <Link href="/seller/products" className="text-hos-gold text-sm hover:text-hos-gold-hover">← Back to products</Link>
        </div>
        <h1 className="text-2xl font-bold mb-6">Volume pricing tiers</h1>
        {loading ? (
          <p className="text-hos-text-muted">Loading...</p>
        ) : (
          <>
            <div className="bg-hos-bg-secondary border rounded-lg p-6 mb-6">
              <h2 className="font-semibold mb-4">Current tiers</h2>
              {tiers.length === 0 ? (
                <p className="text-hos-text-muted text-sm">No volume tiers defined yet.</p>
              ) : (
                <ul className="space-y-2">
                  {tiers.map((t) => (
                    <li key={t.id || `${t.minQuantity}-${t.price}`} className="flex justify-between text-sm border-b border-hos-border py-2">
                      <span>Min {t.minQuantity} units</span>
                      <span className="text-hos-gold font-medium">{formatPrice(t.price)} / unit</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="bg-hos-bg-secondary border rounded-lg p-6">
              <h2 className="font-semibold mb-4">Add tier</h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div>
                  <label className="block text-sm mb-1">Min quantity</label>
                  <input type="number" min={1} value={minQty} onChange={(e) => setMinQty(e.target.value)} className="px-3 py-2 border rounded-lg bg-hos-bg-secondary border-hos-border w-32" />
                </div>
                <div>
                  <label className="block text-sm mb-1">Price per unit</label>
                  <input type="number" min={0} step="0.01" value={tierPrice} onChange={(e) => setTierPrice(e.target.value)} className="px-3 py-2 border rounded-lg bg-hos-bg-secondary border-hos-border w-32" />
                </div>
                <button type="button" onClick={addTier} className="px-4 py-2 bg-hos-gold text-[#1a1406] rounded-lg font-medium hover:bg-hos-gold-hover">
                  Add tier
                </button>
              </div>
            </div>
          </>
        )}
      </DashboardLayout>
    </RouteGuard>
  );
}
