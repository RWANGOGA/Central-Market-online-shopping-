import { requireAdmin } from '@/lib/catalogue';
import { forecast } from '@/lib/analytics';
import { error, json } from '@/lib/http';

export async function GET(request: Request) {
  const admin = await requireAdmin(request);
  if (!admin) return error('Not signed in', 401);

  const data = await forecast();

  return json({
    data,
    meta: {
      generatedAt: new Date().toISOString(),
      note: 'Forecast is a trailing average, not a prediction. Seasonality flags must be entered by staff.',
    },
  });
}
