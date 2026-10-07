let scheduler: (orderId: string) => Promise<void> = async () => {};

export function setOrderAutoCancelScheduler(next: (orderId: string) => Promise<void>): void {
  scheduler = next;
}

export function scheduleOrderAutoCancel(orderId: string): Promise<void> {
  return scheduler(orderId);
}
