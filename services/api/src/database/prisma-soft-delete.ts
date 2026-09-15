import { Prisma } from '@prisma/client';

const SOFT_DELETE_MODELS = new Set(['User', 'Product', 'Seller', 'Order', 'ProductSubmission']);

const FILTERED_OPERATIONS = new Set(['findMany', 'findFirst', 'findFirstOrThrow', 'count']);

async function applySoftDeleteFilter(params: {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
}): Promise<unknown> {
  const { model, operation, query: run } = params;
  const rawArgs = params.args;

  if (!model || !SOFT_DELETE_MODELS.has(model) || !FILTERED_OPERATIONS.has(operation)) {
    return run(rawArgs);
  }

  const typedArgs: Record<string, unknown> =
    rawArgs && typeof rawArgs === 'object' ? { ...(rawArgs as Record<string, unknown>) } : {};

  const where = (typedArgs.where ?? {}) as Record<string, unknown>;

  if (where.deletedAt === undefined) {
    typedArgs.where = { ...where, deletedAt: null };
  }

  return run(typedArgs);
}

export const softDeleteExtension = Prisma.defineExtension({
  name: 'soft-delete',
  query: {
    $allModels: {
      $allOperations: applySoftDeleteFilter as never,
    },
  },
});
