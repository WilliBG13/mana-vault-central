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
  collection_id: string;
}

const Search = () => {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, any[]>>({});

  const onSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const supabase = getSupabase();
    setLoading(true);
    try {
      const { data: cards } = await supabase
        .from("cards")
        .select("id, card_name, quantity, set_name, collection_id")
        .ilike("card_name", `%${q}%`)
        .limit(500);

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

      const grouped: Record<string, any[]> = {};
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
          quantity: r.quantity,
          collection: col?.name || "Unknown",
          owner: ownerName,
        });
      }
      setResults(grouped);
    } finally {
      setLoading(false);
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
                <h2 className="text-lg font-semibold">{owners[0].card_name}</h2>
              </div>
              <div className="divide-y">
                {owners.map((o: any, idx: number) => (
                  <div key={idx} className="grid grid-cols-2 gap-2 p-3 sm:grid-cols-5">
                      <div className="truncate"><span className="text-muted-foreground">Owner:</span> {o.owner}</div>
                      <div className="truncate"><span className="text-muted-foreground">Collection:</span> {o.collection}</div>
                      <div className="truncate"><span className="text-muted-foreground">Set:</span> {o.set_name || "-"}</div>
                      <div className="truncate"><span className="text-muted-foreground">Qty:</span> {o.quantity}</div>
                      <div className="truncate hidden sm:block text-muted-foreground">Card: {o.card_name}</div>
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
