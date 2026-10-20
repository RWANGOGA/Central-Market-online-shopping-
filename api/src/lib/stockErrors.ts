/**
 * Raised when a stock movement cannot be applied: not enough stock for a
 * negative delta, or the product does not exist.
 *
 * Lives in its own module because both the order route and the stock ledger
 * need it, and importing one from the other would be a cycle.
 */
export class StockConflict extends Error {
  constructor(
    public productId: number,
    /** Filled in by the caller that knows the product's name, for the message. */
    public productName?: string,
  ) {
    super(`Stock conflict on product ${productId}`);
    this.name = 'StockConflict';
  }
}
