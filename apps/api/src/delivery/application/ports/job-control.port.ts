/** Lets ProcessDeliveryUseCase reschedule the underlying queue job without importing BullMQ directly. */
export interface JobControl {
  defer(delayMs: number): Promise<void>;
}
