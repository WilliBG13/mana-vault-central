import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CardData {
  name: string;
  setName?: string;
  collectorNumber?: string;
}

interface CardPriceRequest {
  cards: CardData[];
}

interface CardPrice {
  name: string;
  price: number | null;
  currency: string;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('JUSTTCG_API_KEY');
    if (!apiKey) {
      throw new Error('JustTCG API key not configured');
    }

    const { cards }: CardPriceRequest = await req.json();
    
    if (!cards || !Array.isArray(cards)) {
      throw new Error('Invalid request: cards array is required');
    }

    console.log(`Fetching prices for ${cards.length} cards`);

    // Fetch prices for each card
    const pricePromises = cards.map(async (cardData): Promise<CardPrice> => {
      try {
        // JustTCG API call - using proper GET parameters
        const url = new URL('https://api.justtcg.com/v1/cards');
        
        // Use the correct parameters mapping
        url.searchParams.append('name', cardData.name);
        url.searchParams.append('game', 'Magic: The Gathering');
        url.searchParams.append('condition', 'Near Mint'); // Always use Near Mint (excellent) condition
        if (cardData.setName) {
          url.searchParams.append('set', cardData.setName);
        }
        if (cardData.collectorNumber) {
          url.searchParams.append('number', cardData.collectorNumber);
        }
        
        console.log(`Fetching price for: ${cardData.name} (${cardData.setName || 'Unknown Set'} #${cardData.collectorNumber || 'N/A'}) - Near Mint condition`);

        console.log(`API URL: ${url.toString()}`);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        console.log(`API Response Status: ${response.status}`);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error(`API error for ${cardData.name}: ${response.status} - ${errorText}`);
          return {
            name: cardData.name,
            price: null,
            currency: 'USD',
            error: `API error: ${response.status} - ${errorText}`
          };
        }

        const data = await response.json();
        console.log(`Raw API Response for ${cardData.name}:`, JSON.stringify(data, null, 2));
        
        // Extract price from JustTCG API response using provided structure
        let price = null;
        
        // Check multiple possible response structures
        if (data && Array.isArray(data) && data.length > 0) {
          // Direct array response
          const card = data[0];
          console.log(`Found card data (array):`, JSON.stringify(card, null, 2));
          if (card.variants && card.variants.length > 0) {
            const nmVariant = card.variants.find(v => v.condition === 'Near Mint' || v.condition === 'NM');
            const variant = nmVariant || card.variants[0];
            price = variant.price;
            console.log(`Extracted price from variant: ${price} (condition: ${variant.condition})`);
          }
        } else if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
          // Wrapped in data property
          const card = data.data[0];
          console.log(`Found card data (data.array):`, JSON.stringify(card, null, 2));
          if (card.variants && card.variants.length > 0) {
            const nmVariant = card.variants.find(v => v.condition === 'Near Mint' || v.condition === 'NM');
            const variant = nmVariant || card.variants[0];
            price = variant.price;
            console.log(`Extracted price from variant: ${price} (condition: ${variant.condition})`);
          }
        } else if (data && data.variants && data.variants.length > 0) {
          // Direct card object
          console.log(`Found direct card with variants:`, JSON.stringify(data, null, 2));
          const nmVariant = data.variants.find(v => v.condition === 'Near Mint' || v.condition === 'NM');
          const variant = nmVariant || data.variants[0];
          price = variant.price;
          console.log(`Extracted price from variant: ${price} (condition: ${variant.condition})`);
        } else {
          console.log(`No matching data structure found for ${cardData.name}. Response keys:`, Object.keys(data || {}));
        }

        return {
          name: cardData.name,
          price: price ? parseFloat(price.toString()) : null,
          currency: 'USD'
        };

      } catch (error) {
        console.error(`Error fetching price for ${cardData.name}:`, error);
        return {
          name: cardData.name,
          price: null,
          currency: 'USD',
          error: error.message
        };
      }
    });

    const prices = await Promise.all(pricePromises);

    console.log(`Successfully fetched prices for ${prices.filter(p => p.price !== null).length}/${prices.length} cards`);

    return new Response(JSON.stringify({ prices }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in get-card-prices function:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});