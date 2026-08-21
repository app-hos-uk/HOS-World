import {
  canAccessAllOrders,
  customerOwnsOrder,
  sellerOwnsOrder,
  staffOwnsStore,
  userOwnsRecord,
} from './ownership.policy';

describe('ownership policies', () => {
  it('staff roles can access all orders', () => {
    expect(canAccessAllOrders('ADMIN')).toBe(true);
    expect(canAccessAllOrders('FINANCE')).toBe(true);
    expect(canAccessAllOrders('B2C_SELLER')).toBe(false);
  });

  it('seller owns a direct assignment', () => {
    expect(sellerOwnsOrder({ sellerId: 's1' }, 's1')).toBe(true);
    expect(sellerOwnsOrder({ sellerId: 's1' }, 's2')).toBe(false);
  });

  it('seller owns via child-order seller ids', () => {
    expect(sellerOwnsOrder({ sellerId: null, childSellerIds: ['s2', 's3'] }, 's3')).toBe(true);
    expect(sellerOwnsOrder({ childSellerIds: ['s2'] }, 's3')).toBe(false);
  });

  it('customer owns their order', () => {
    expect(customerOwnsOrder({ userId: 'u1' }, 'u1')).toBe(true);
    expect(customerOwnsOrder({ userId: 'u1' }, 'u2')).toBe(false);
  });

  it('userOwnsRecord and staffOwnsStore', () => {
    expect(userOwnsRecord('a', 'a')).toBe(true);
    expect(staffOwnsStore('store-1', 'store-1')).toBe(true);
    expect(staffOwnsStore('store-1', 'store-2')).toBe(false);
  });
});
