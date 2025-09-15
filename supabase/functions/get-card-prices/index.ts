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
        if (cardData.setName) {
          url.searchParams.append('set', cardData.setName);
        }
        if (cardData.collectorNumber) {
          url.searchParams.append('number', cardData.collectorNumber);
        }
        
        console.log(`Fetching price for: ${cardData.name} (${cardData.setName || 'Unknown Set'} #${cardData.collectorNumber || 'N/A'})`);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'x-api-key': apiKey,
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
        console.log(`API Response for ${cardData.name}:`, JSON.stringify(data, null, 2));
        
        // Extract price from JustTCG API response using provided structure
        let price = null;
        if (data && data.length > 0) {
          const card = data[0];
          // Get price from variants array
          if (card.variants && card.variants.length > 0) {
            // Look for Near Mint condition first, fallback to first available
            const nmVariant = card.variants.find(v => v.condition === 'Near Mint' || v.condition === 'NM');
            const variant = nmVariant || card.variants[0];
            price = variant.price;
            console.log(`Found price for ${cardData.name}: ${price} (condition: ${variant.condition})`);
          } else {
            console.log(`No variants found for ${cardData.name}`);
          }
        } else {
          console.log(`No data returned for ${cardData.name}`);
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