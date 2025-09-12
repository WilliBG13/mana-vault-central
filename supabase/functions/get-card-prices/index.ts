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
        // JustTCG API call - using GET with query parameters
        const url = new URL('https://api.justtcg.com/v1/cards');
        
        // Build search query with available card data
        let searchQuery = cardData.name;
        if (cardData.setName) {
          searchQuery += ` set:"${cardData.setName}"`;
        }
        if (cardData.collectorNumber) {
          searchQuery += ` number:"${cardData.collectorNumber}"`;
        }
        
        url.searchParams.append('q', searchQuery);
        url.searchParams.append('limit', '1');
        
        console.log(`Searching for: ${searchQuery}`);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'X-API-Key': apiKey,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error(`API error for ${cardData.name}: ${response.status} - ${await response.text()}`);
          return {
            name: cardData.name,
            price: null,
            currency: 'USD',
            error: `API error: ${response.status}`
          };
        }

        const data = await response.json();
        
        // Extract price from JustTCG API response
        let price = null;
        if (data.data && data.data.length > 0) {
          const card = data.data[0];
          // Get price from the first variant (usually Near Mint condition)
          if (card.variants && card.variants.length > 0) {
            // Look for Near Mint condition first, fallback to first available
            const nmVariant = card.variants.find(v => v.condition === 'Near Mint' || v.condition === 'NM');
            const variant = nmVariant || card.variants[0];
            price = variant.price;
          }
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