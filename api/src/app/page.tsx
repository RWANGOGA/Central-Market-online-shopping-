const ENDPOINTS = [
  ['GET', '/api/products', 'Catalogue, ?search= & ?includeInactive='],
  ['GET', '/api/products/:idOrSlug', 'Single product'],
  ['POST', '/api/customers', 'Upsert by email'],
  ['GET', '/api/customers?email=', 'Lookup by email'],
  ['POST', '/api/cart', 'Create cart'],
  ['GET', '/api/cart?cartId=', 'Read cart with totals'],
  ['POST', '/api/cart/items', 'Add item (cartId, productId, quantity)'],
  ['PATCH', '/api/cart', 'Set quantity (0 removes)'],
  ['POST', '/api/orders', 'Convert cart to order'],
  ['GET', '/api/orders?customerId=', 'List orders'],
  ['GET', '/api/orders/:idOrRef', 'Order with line items'],
  ['PATCH', '/api/orders/:idOrRef', 'Update status'],
  ['GET', '/api/assets/:file', 'Product images from src/assets'],
];

export default function Home() {
  return (
    <main>
      <h1 style={{ fontSize: '1.25rem' }}>Grocery API</h1>
      <p style={{ color: '#555' }}>
        Next.js 15 route handlers over SQLite via Drizzle ORM.
      </p>
      <table style={{ borderCollapse: 'collapse', marginTop: '1rem' }}>
        <tbody>
          {ENDPOINTS.map(([method, path, note]) => (
            <tr key={`${method} ${path}`} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '0.35rem 1rem 0.35rem 0', color: '#0a7' }}>{method}</td>
              <td style={{ padding: '0.35rem 1rem 0.35rem 0' }}>{path}</td>
              <td style={{ padding: '0.35rem 0', color: '#777' }}>{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}