import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

export function useProduct(idOrSlug: string) {
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);

  return useQuery({
    queryKey: ['product', idOrSlug],
    queryFn: async () => {
      const response = isUuid
        ? await apiClient.getProduct(idOrSlug)
        : await apiClient.getProductBySlug(idOrSlug);
      return response?.data;
    },
    enabled: !!idOrSlug,
    staleTime: 2 * 60 * 1000,
  });
}

export function useProducts(params: {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}) {
  return useQuery({
    queryKey: [
      'products',
      params.page ?? 1,
      params.limit ?? 20,
      params.category ?? '',
      params.search ?? '',
    ],
    queryFn: async () => {
      const response = await apiClient.getProducts(params);
      return response?.data;
    },
    staleTime: 60 * 1000,
  });
}
