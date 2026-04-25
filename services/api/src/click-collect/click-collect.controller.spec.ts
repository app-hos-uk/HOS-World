import { Test } from '@nestjs/testing';
import { ClickCollectAdminController } from './click-collect-admin.controller';
import { ClickCollectCustomerController } from './click-collect-customer.controller';
import { ClickCollectService } from './click-collect.service';

describe('ClickCollect controllers', () => {
  const cc = {
    adminList: jest.fn().mockResolvedValue([]),
    adminGet: jest.fn().mockResolvedValue({ id: '1' }),
    markPreparing: jest.fn().mockResolvedValue({}),
    markReady: jest.fn().mockResolvedValue({}),
    markCollected: jest.fn().mockResolvedValue({}),
    cancelClickCollect: jest.fn().mockResolvedValue({}),
    createClickCollect: jest.fn().mockResolvedValue({ id: 'cc' }),
    listMine: jest.fn().mockResolvedValue([]),
    getEligibleStores: jest.fn().mockResolvedValue([]),
  };

  describe('ClickCollectAdminController', () => {
    let controller: ClickCollectAdminController;
    beforeEach(async () => {
      jest.clearAllMocks();
      const m = await Test.createTestingModule({
        controllers: [ClickCollectAdminController],
        providers: [{ provide: ClickCollectService, useValue: cc }],
      }).compile();
      controller = m.get(ClickCollectAdminController);
    });

    it('list', async () => {
      await controller.list('s1', 'READY');
      expect(cc.adminList).toHaveBeenCalledWith({ storeId: 's1', status: 'READY' });
    });

    it('get', async () => {
      await controller.get('x');
      expect(cc.adminGet).toHaveBeenCalledWith('x');
    });

    it('preparing', async () => {
      await controller.preparing('x');
      expect(cc.markPreparing).toHaveBeenCalledWith('x');
    });

    it('ready', async () => {
      await controller.ready('x');
      expect(cc.markReady).toHaveBeenCalledWith('x');
    });

    it('collected', async () => {
      await controller.collected('x', { user: { id: 'adm' } } as any);
      expect(cc.markCollected).toHaveBeenCalledWith('x', 'adm');
    });

    it('cancel', async () => {
      await controller.cancel('x');
      expect(cc.cancelClickCollect).toHaveBeenCalledWith('x');
    });
  });

  describe('ClickCollectCustomerController', () => {
    let controller: ClickCollectCustomerController;
    beforeEach(async () => {
      jest.clearAllMocks();
      const m = await Test.createTestingModule({
        controllers: [ClickCollectCustomerController],
        providers: [{ provide: ClickCollectService, useValue: cc }],
      }).compile();
      controller = m.get(ClickCollectCustomerController);
    });

    it('create', async () => {
      await controller.create(
        { user: { id: 'u1' } } as any,
        { orderId: 'o1', storeId: 's1' } as any,
      );
      expect(cc.createClickCollect).toHaveBeenCalledWith('u1', { orderId: 'o1', storeId: 's1' });
    });

    it('mine', async () => {
      await controller.mine({ user: { id: 'u1' } } as any);
      expect(cc.listMine).toHaveBeenCalledWith('u1');
    });

    it('stores', async () => {
      await controller.stores('a,b');
      expect(cc.getEligibleStores).toHaveBeenCalledWith(['a', 'b'], { verifyInventory: false });
    });

    it('stores with verifyInventory', async () => {
      await controller.stores('a', 'true');
      expect(cc.getEligibleStores).toHaveBeenCalledWith(['a'], { verifyInventory: true });
    });
  });
});
