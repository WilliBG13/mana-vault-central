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
        url.searchParams.append('q', cardData.name, '&');
        url.searchParams.append('game', 'mtg', '&');
        url.searchParams.append('condition', 'Lightly Played', '&'); // Always use Near Mint (excellent) condition
        url.searchParams.append('set', cardData.setName, '&');
        url.searchParams.append('index', '10'); //return top 10 searches
       
        console.log(`Fetching price for: ${cardData.name} (${cardData.setName || 'Unknown Set'} #${cardData.collectorNumber || 'N/A'}) - Near Mint condition`);

        console.log(`API URL: ${url.toString()}`);

        // curl -X GET "https://api.justtcg.com/v1/cards?q=Counterspell&game=mtg&condition=Near%20Mint&printing=1st%20Edition&limit=1" \ -H "X-API-Key: your_api_key_here"
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
        console.log(`Raw API Response for ${cardData.name}:`, JSON.stringify(data, null, 1));
        
        // Extract price from JustTCG API response using provided structure
        let price: number | null = null;

        // Normalize helpers
        const norm = (v?: string) => (v || "").toLowerCase().trim();
        const requestedName = norm(cardData.name);
        const requestedSet = norm(cardData.setName || "");
        const requestedNum = (cardData.collectorNumber || "").toString().trim();

        // Build a flat list of candidate cards from various possible shapes
        const candidates: any[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : data ? [data] : [];

        // Choose the best matching card
        let matched: any | undefined = candidates.find((c) => {
          const cname = norm(c.name);
          const cset = norm(c.set || c.setName);
          const cnum = (c.number || c.collectorNumber || c.details?.number || "").toString().trim();
          return cname === requestedName && cnum === requestedNum && (!!requestedSet ? cset === requestedSet : true);
        });

        if (!matched) {
          // Fallback: match by name + number only
          matched = candidates.find((c) => {
            const cname = norm(c.name);
            const cnum = (c.number || c.collectorNumber || c.details?.number || "").toString().trim();
            return cname === requestedName && cnum === requestedNum;
          });
        }

        if (!matched) {
          // Fallback: match by exact name
          matched = candidates.find((c) => norm(c.name) === requestedName);
        }

        if (matched) {
          console.log(`Matched card for ${cardData.name}:`, JSON.stringify({
            matchedName: matched.name,
            matchedSet: matched.set || matched.setName,
            matchedNumber: matched.number || matched.collectorNumber || matched.details?.number,
          }));

          const variants = matched.variants || [];
          if (variants.length > 0) {
            const nmVariant = variants.find((v: any) => v.condition === 'Near Mint' || v.condition === 'NM' || v.condition === 'Excellent');
            const variant = nmVariant || variants[0];
            price = variant?.price != null ? Number(variant.price) : null;
            console.log(`Using variant for ${cardData.name}:`, JSON.stringify({ condition: variant?.condition, price }));
          } else {
            console.log(`No variants on matched card for ${cardData.name}`);
          }
        } else {
          console.log(`No candidate matched for ${cardData.name}. Candidates:`, candidates.map((c) => ({ name: c?.name, set: c?.set || c?.setName, number: c?.number || c?.collectorNumber })).slice(0, 5));
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
