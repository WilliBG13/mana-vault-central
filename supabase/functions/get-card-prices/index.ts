import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CardPriceRequest {
  cardNames: string[];
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

    const { cardNames }: CardPriceRequest = await req.json();
    
    if (!cardNames || !Array.isArray(cardNames)) {
      throw new Error('Invalid request: cardNames array is required');
    }

    console.log(`Fetching prices for ${cardNames.length} cards`);

    // Fetch prices for each card
    const pricePromises = cardNames.map(async (cardName): Promise<CardPrice> => {
      try {
        // JustTCG API call - using a common pattern for TCG APIs
        const searchUrl = `https://api.justtcg.com/v1/cards/search`;
        const response = await fetch(searchUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: cardName,
            game: 'magic', // Assuming Magic: The Gathering
            limit: 1
          }),
        });

        if (!response.ok) {
          console.error(`API error for ${cardName}: ${response.status}`);
          return {
            name: cardName,
            price: null,
            currency: 'USD',
            error: `API error: ${response.status}`
          };
        }

        const data = await response.json();
        
        // Extract price from API response
        let price = null;
        if (data.results && data.results.length > 0) {
          const card = data.results[0];
          // Common price field names in TCG APIs
          price = card.market_price || card.price || card.mid_price || card.avg_price;
        }

        return {
          name: cardName,
          price: price ? parseFloat(price) : null,
          currency: 'USD'
        };

      } catch (error) {
        console.error(`Error fetching price for ${cardName}:`, error);
        return {
          name: cardName,
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