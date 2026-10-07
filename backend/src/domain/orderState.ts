import type { OrderStatus } from '@prisma/client';

const validTransitions: Record<OrderStatus, readonly OrderStatus[]> = {
  PLACED: ['PACKED', 'CANCELLED'],
  PACKED: ['OUT_FOR_DELIVERY', 'CANCELLED'],
  OUT_FOR_DELIVERY: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(current: OrderStatus, next: OrderStatus): boolean {
  return validTransitions[current].includes(next);
}

export function allowedTransitions(current: OrderStatus): readonly OrderStatus[] {
  return validTransitions[current];
}

export function timestampFieldForStatus(
  status: OrderStatus,
): 'packedAt' | 'outForDeliveryAt' | 'deliveredAt' | 'cancelledAt' | null {
  switch (status) {
    case 'PACKED':
      return 'packedAt';
    case 'OUT_FOR_DELIVERY':
      return 'outForDeliveryAt';
    case 'DELIVERED':
      return 'deliveredAt';
    case 'CANCELLED':
      return 'cancelledAt';
    default:
      return null;
  }
}
