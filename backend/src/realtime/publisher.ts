type RealtimeListener = (event: string, payload: unknown) => void;

let listener: RealtimeListener | null = null;

export function setRealtimePublisher(next: RealtimeListener | null): void {
  listener = next;
}

export function publish(event: string, payload: unknown): void {
  listener?.(event, payload);
}
