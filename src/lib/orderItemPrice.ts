/**
 * Cart-created orders store the option-inclusive amount in unit_price;
 * server checkout orders store it in price. Options are nonnegative add-ons,
 * so the larger stored amount includes them without adding them twice.
 */
export function orderItemUnitPrice(item: { price: number; unit_price?: number }): number {
  return Math.max(item.price, item.unit_price ?? item.price);
}
