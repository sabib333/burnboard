// BURNBOARD Tip & Coffee Monetization Route Placeholder (Stripe / Buy Me a Coffee Webhook Handler)

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { amount = 5, currency = 'usd', donor_name = 'Anonymous Burner', note = '' } = body;

    // In production, integrate Stripe Checkout or Lemonsqueezy session creation:
    // const session = await stripe.checkout.sessions.create({ ... });

    return new Response(
      JSON.stringify({
        status: 'success',
        message: 'Coffee tip received! You kept the servers brutal 🔥',
        data: {
          amount,
          currency,
          donor_name,
          note,
          checkout_url: 'https://buymeacoffee.com',
        },
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ status: 'error', message: error.message || 'Payment initiation failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

export async function GET() {
  return new Response(
    JSON.stringify({
      name: 'BURNBOARD Monetization Endpoint',
      currency: 'USD',
      coffee_cost: 5.0,
      supporter_url: 'https://buymeacoffee.com',
      sponsored_slot_weekly_rate: 10.0,
      sponsor_contact: 'sabibahamed74@gmail.com',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
