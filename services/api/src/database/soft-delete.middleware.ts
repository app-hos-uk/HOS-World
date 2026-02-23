import { Prisma } from '@prisma/client';

const softDeleteModels = ['User', 'Product', 'Order', 'Seller', 'ProductSubmission'];

/**
 * Returns Prisma extension that converts delete to soft-delete
 * and filters soft-deleted records on find/count operations.
 */
export function softDeleteExtension() {
  return Prisma.defineExtension({
    name: 'softDelete',
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          if (model && softDeleteModels.includes(model)) {
            return (Prisma as any).getExtensionContext(this)[model].update({
              ...args,
              data: { deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async deleteMany({ model, args, query }) {
          if (model && softDeleteModels.includes(model)) {
            return (Prisma as any).getExtensionContext(this)[model].updateMany({
              ...args,
              data: { ...(args as any)?.data, deletedAt: new Date() },
            });
          }
          return query(args);
        },
        async findFirst({ model, args, query }) {
          if (model && softDeleteModels.includes(model)) {
            args = args || {};
            args.where = { ...args.where, deletedAt: (args.where as any)?.deletedAt ?? null };
          }
          return query(args);
        },
        async findMany({ model, args, query }) {
          if (model && softDeleteModels.includes(model)) {
            args = args || {};
            args.where = { ...args.where, deletedAt: (args.where as any)?.deletedAt ?? null };
          }
          return query(args);
        },
        async count({ model, args, query }) {
          if (model && softDeleteModels.includes(model)) {
            args = args || {};
            args.where = { ...args.where, deletedAt: (args.where as any)?.deletedAt ?? null };
          }
          return query(args);
        },
      },
    },
  });
}
