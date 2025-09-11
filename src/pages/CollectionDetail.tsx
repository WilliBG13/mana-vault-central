import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { getSupabase } from "@/lib/supabaseClient";
import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";

const fetchCollection = async (id: string) => {
  const supabase = getSupabase();
  const { data: collection, error: cErr } = await supabase.from("collections").select("id, name, created_at").eq("id", id).single();
  if (cErr) throw cErr;
  const { data: cards, error: kErr } = await supabase
    .from("cards")
    .select("id, card_name, quantity, set_name")
    .eq("collection_id", id)
    .order("card_name");
  if (kErr) throw kErr;
  return { collection, cards: cards || [] };
};

const CollectionDetail = () => {
  const { id = "" } = useParams();
  const [q, setQ] = useState("");
  const { data, isLoading, error } = useQuery({ queryKey: ["collection", id], queryFn: () => fetchCollection(id) });
  const filtered = useMemo(
    () => (data?.cards || []).filter((c) => c.card_name.toLowerCase().includes(q.toLowerCase())),
    [q, data]
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        {isLoading ? (
          <div className="h-40 animate-pulse rounded-md border" />
        ) : error ? (
          <p className="text-destructive">Failed to load collection.</p>
        ) : (
          <>
            <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h1 className="text-3xl font-bold">{data!.collection.name}</h1>
                <p className="text-sm text-muted-foreground">
                  Imported {new Date(data!.collection.created_at).toLocaleString()}
                </p>
              </div>
              <Input placeholder="Filter cards..." value={q} onChange={(e) => setQ(e.target.value)} className="max-w-sm" />
            </div>
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-left">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="p-3">Card</th>
                    <th className="p-3">Set</th>
                    <th className="p-3">Qty</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((c: any) => (
                    <tr key={c.id} className="border-t">
                      <td className="p-3">{c.card_name}</td>
                      <td className="p-3">{c.set_name || "-"}</td>
                      <td className="p-3">{c.quantity}</td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td className="p-4 text-muted-foreground" colSpan={3}>
                        No cards match your filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CollectionDetail;
