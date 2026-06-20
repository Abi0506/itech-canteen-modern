const toNumber = (value) => Number(value || 0);

const getItemKey = (item) => {
  const productId = item.product_id ?? item.id ?? 'unknown';
  const name = item.product_name || item.name || '';
  const price = item.unit_price ?? item.rate ?? item.price ?? 0;
  const notes = item.notes || '';
  return `${productId}|${name}|${Number(price).toFixed(2)}|${notes}`;
};

export const groupOrderItems = (items = []) => {
  const grouped = new Map();

  items.forEach((item) => {
    const key = getItemKey(item);
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unit_price ?? item.rate ?? item.price);
    const lineTotal = toNumber(item.line_total ?? unitPrice * quantity);

    if (!grouped.has(key)) {
      grouped.set(key, {
        ...item,
        quantity,
        unit_price: item.unit_price ?? item.rate ?? item.price ?? 0,
        line_total: lineTotal,
      });
      return;
    }

    const existing = grouped.get(key);
    existing.quantity += quantity;
    existing.line_total += lineTotal;
  });

  return Array.from(grouped.values());
};
