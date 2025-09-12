import { useMemo, useState } from "react";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { getSupabase } from "@/lib/supabaseClient";

interface CardRow {
  id: string;
  card_name: string;
  quantity: number;
  set_name: string | null;
  collector_number: string | null;
  collection_id: string;
}

interface CardPrice {
  name: string;
  price: number | null;
  currency: string;
  error?: string;
}

interface CardWithPrice {
  card_name: string;
  set_name: string | null;
  collector_number: string | null;
  quantity: number;
  collection: string;
  owner: string;
  price: number | null;
}

const Search = () => {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, CardWithPrice[]>>({});
  const [priceLoading, setPriceLoading] = useState(false);

  const onSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const supabase = getSupabase();
    setLoading(true);
    try {
      const { data: cards } = await supabase
        .from("cards")
        .select("id, card_name, quantity, set_name, collector_number, collection_id")
        .ilike("card_name", `%${q}%`)
        .limit(500);

      console.log("Search results:", cards?.slice(0, 3)); // Debug log

      const rows = (cards as CardRow[]) || [];
      const ids = Array.from(new Set(rows.map((r) => r.collection_id)));
      const { data: collections } = await supabase
        .from("collections")
        .select("id, name, user_id")
        .in("id", ids);

      // Build collection map
      const cmap = new Map((collections || []).map((c: any) => [c.id, c]));

      // Fetch usernames for owners
      const userIds = Array.from(new Set((collections || []).map((c: any) => c.user_id)));
      let pmap = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id, username, display_name")
          .in("user_id", userIds);
        pmap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      }

      const grouped: Record<string, CardWithPrice[]> = {};
      for (const r of rows) {
        const col = cmap.get(r.collection_id);
        const ownerName =
          (col && pmap.get(col.user_id)?.username) ||
          (col?.user_id ? col.user_id.slice(0, 8) : "Unknown");
        const key = r.card_name.toLowerCase();
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push({
          card_name: r.card_name,
          set_name: r.set_name,
          collector_number: r.collector_number,
          quantity: r.quantity,
          collection: col?.name || "Unknown",
          owner: ownerName,
          price: null, // Will be fetched separately
        });
      }
      setResults(grouped);

      // Fetch prices for unique card names
      if (Object.keys(grouped).length > 0) {
        fetchPrices(Object.keys(grouped));
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchPrices = async (cardKeys: string[]) => {
    setPriceLoading(true);
    try {
      const supabase = getSupabase();
      const cards = cardKeys.map(key => {
        const firstCard = results[key]?.[0];
        return {
          name: firstCard?.card_name || key,
          setName: firstCard?.set_name || undefined,
          collectorNumber: firstCard?.collector_number || undefined
        };
      });

      const { data, error } = await supabase.functions.invoke('get-card-prices', {
        body: { cards }
      });

      if (error) {
        console.error('Error fetching prices:', error);
        return;
      }

      if (data?.prices) {
        // Create a map of card name to price
        const priceMap = new Map<string, number | null>();
        data.prices.forEach((priceData: CardPrice) => {
          priceMap.set(priceData.name.toLowerCase(), priceData.price);
        });

        // Update results with prices
        setResults(prevResults => {
          const updatedResults = { ...prevResults };
          Object.keys(updatedResults).forEach(key => {
            const cardName = updatedResults[key][0]?.card_name;
            if (cardName) {
              const price = priceMap.get(cardName.toLowerCase());
              updatedResults[key] = updatedResults[key].map(card => ({
                ...card,
                price
              }));
            }
          });
          return updatedResults;
        });
      }
    } catch (error) {
      console.error('Error calling price function:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  const groups = useMemo(() => Object.entries(results).sort(), [results]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        <h1 className="mb-4 text-3xl font-bold">Global Card Search</h1>
        <form onSubmit={onSearch} className="mb-6 flex max-w-xl items-center gap-3">
          <Input placeholder="Search by card name..." value={q} onChange={(e) => setQ(e.target.value)} />
          <Button type="submit" disabled={loading || !q.trim()}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </form>

        {groups.length === 0 && !loading && <p className="text-muted-foreground">No results yet. Try searching!</p>}

        <div className="grid gap-6">
          {groups.map(([cardKey, owners]) => (
            <div key={cardKey} className="rounded-md border">
              <div className="border-b bg-muted/50 p-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">{owners[0].card_name}</h2>
                  <div className="flex items-center gap-2">
                    {priceLoading ? (
                      <span className="text-sm text-muted-foreground">Loading price...</span>
                    ) : owners[0].price ? (
                      <span className="text-lg font-semibold text-green-600">${owners[0].price.toFixed(2)}</span>
                    ) : (
                      <span className="text-sm text-muted-foreground">Price unavailable</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="divide-y">
                {owners.map((o: CardWithPrice, idx: number) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-7">
                      <div className="truncate"><span className="text-muted-foreground">Owner:</span> {o.owner}</div>
                      <div className="truncate"><span className="text-muted-foreground">Collection:</span> {o.collection}</div>
                      <div className="truncate"><span className="text-muted-foreground">Set:</span> {o.set_name || "-"}</div>
                      <div className="truncate"><span className="text-muted-foreground">Set #:</span> {o.collector_number || "-"}</div>
                      <div className="truncate"><span className="text-muted-foreground">Qty:</span> {o.quantity}</div>
                      <div className="truncate"><span className="text-muted-foreground">Price:</span> {o.price ? `$${o.price.toFixed(2)}` : "N/A"}</div>
                      <div className="truncate hidden sm:block text-muted-foreground">Total: {o.price ? `$${(o.price * o.quantity).toFixed(2)}` : "N/A"}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Search;
