import Stripe from 'stripe';

// Lazily constructed so importing this module never throws when Stripe is
// not configured (the mobile app bills through Apple IAP).
let stripeClient: Stripe | null = null;
function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
  }
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-09-30.clover" });
  }
  return stripeClient;
}

/**
 * Get or create the Fusion Premium subscription price
 * This creates a fixed price of £9.99/month for the Fusion Premium subscription
 */
export async function getOrCreatePriceId(): Promise<string> {
  // Check if we have a stored price ID in env
  if (process.env.STRIPE_PRICE_ID) {
    try {
      // Verify the price still exists
      await getStripe().prices.retrieve(process.env.STRIPE_PRICE_ID);
      return process.env.STRIPE_PRICE_ID;
    } catch (error) {
      console.log('Stored price ID not found, creating new one...');
    }
  }

  // Search for existing Fusion Premium product
  const products = await getStripe().products.search({
    query: "name:'Fusion Premium'",
  });

  let productId: string;

  if (products.data.length > 0) {
    productId = products.data[0].id;
    console.log('Found existing Fusion Premium product:', productId);
  } else {
    // Create new product
    const product = await getStripe().products.create({
      name: 'Fusion Premium',
      description: 'Premium subscription for Fusion - Luxury Muslim matchmaking platform',
    });
    productId = product.id;
    console.log('Created new Fusion Premium product:', productId);
  }

  // Search for existing price for this product
  const prices = await getStripe().prices.list({
    product: productId,
    active: true,
    type: 'recurring',
  });

  // Find the £9.99/month price
  const existingPrice = prices.data.find(
    price => 
      price.currency === 'gbp' && 
      price.unit_amount === 999 &&
      price.recurring?.interval === 'month'
  );

  if (existingPrice) {
    console.log('Found existing £9.99/month price:', existingPrice.id);
    return existingPrice.id;
  }

  // Create new price
  const price = await getStripe().prices.create({
    product: productId,
    currency: 'gbp',
    unit_amount: 999, // £9.99 in pence
    recurring: { 
      interval: 'month',
    },
  });

  console.log('Created new £9.99/month price:', price.id);
  console.log('\n⚠️  IMPORTANT: Add this to your Replit Secrets:');
  console.log(`STRIPE_PRICE_ID=${price.id}\n`);

  return price.id;
}
