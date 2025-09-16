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
 // Build a flat list of candidate cards from various possible shapes
interface RawVariant {
  id: string;
  condition: string;
  printing: string;
  language: string;
  price: number;
}
interface RawCandidate {
  id: string;
  name: string;
  game: string;
  set: string;
  number: string;
  rarity: string;
  tcgplayerId: string;
  details: any;
  variants: RawVariant[] | RawVariant | null | undefined;
}
interface VariantCandidate {
  id: string;     // variant id
  number: string; // parent card number
  set: string;
  name: string;
  condition: string;
  printing: string;
  price: number;
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
        url.searchParams.append('include_price_history', 'false'); // disable price history to prevent log truncation
       
        console.log(`Fetching price for: ${cardData.name} (${cardData.setName || 'Unknown Set'} #${cardData.collectorNumber || 'N/A'})`);

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
        console.log(`Raw API Response for ${cardData.name}:`, JSON.stringify(data, null, 2));
        
        // Extract price from JustTCG API response using provided structure
        let price: number | null = null;

        // Normalize helpers
        const norm = (v?: string) => (v || "").toLowerCase().trim();
        const requestedName = norm(cardData.name);
        const requestedSet = norm(cardData.setName || "");
        const requestedNum = (cardData.collectorNumber || "").toString().trim();

        const rawList: RawCandidate[] =
          Array.isArray(data)
          ? data as RawCandidate[]
          : (data && typeof data === "object" && Array.isArray((data as any).data))
          ? (data as any).data as RawCandidate[]
          : data
          ? [data as RawCandidate]
          : [];
        // Flatten into variants that carry the parent’s number
        const candidates: VariantCandidate[] = rawList.reduce<VariantCandidate[]>((acc, card) => {
          const parentNumber = (card.number ?? "").toString().trim();
          const parentSet = (card.set ?? "").toString().trim();
          const parentName = (card.name ?? "").toString().trim();
          const variantsArray: RawVariant[] =
            Array.isArray(card.variants)
            ? card.variants
            : card.variants
            ? [card.variants]
            : [];
          for (const variant of variantsArray) {
            // Optional: runtime guard
            if (!variant || typeof variant !== "object") continue;
            acc.push({
              id: variant.id,
              number: parentNumber,
              set: parentSet,
              name: parentName,
              condition: variant.condition,
              printing: variant.printing,
              price: variant.price,
            });
          }
          return acc;
        }, []);

        // Debug if needed:
        console.log("Is rawList array?", Array.isArray(rawList), "length:", rawList.length);
        console.log("candidates:", candidates);

        // Choose the best matching card
        let matched: any | undefined = candidates.find((c) => {
          const cname = norm(c.name);
          const cset = norm(c.set || c.setName);
          
          return cname === requestedName && (!!requestedSet ? cset === requestedSet : true);
        });

        if (!matched) {
          // Fallback: match by name + number only
          matched = candidates.find((c) => {
            const cname = norm(c.name);
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
          }));
          
          if (candidates.length > 0) {
            const nmVariant = candidates.find((v: VariantCandidate) => {
              const vnum = norm(v.number);
              const vprint = norm(v.printing);
              return vnum === requestedNum && vprint === `normal`); //make sure to change printing once import mapping fixed
          }
            const variant = nmVariant || candidates[0];
            price = variant?.price != null ? Number(variant.price) : null;
            console.log(`nmVariant output: ${nmVariant}`);
            console.log(`Using Variant card number ${variant?.number}`);
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
