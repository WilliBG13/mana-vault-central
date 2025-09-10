import { useEffect, useState } from "react";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { getSupabase } from "@/lib/supabaseClient";
import { Link } from "react-router-dom";

const Index = () => {
  const { user } = useAuth();
  const [counts, setCounts] = useState<{ collections: number; cards: number }>({ collections: 0, cards: 0 });

  useEffect(() => {
    const load = async () => {
      try {
        if (!user) return;
        const supabase = getSupabase();
        const { data: collections } = await supabase.from("collections").select("id").eq("user_id", user.id);
        const { count: cardCount } = await supabase
          .from("cards")
          .select("id", { count: "exact", head: true })
          .in(
            "collection_id",
            (collections || []).map((c) => c.id)
          );
        setCounts({ collections: collections?.length || 0, cards: cardCount || 0 });
      } catch (e) {
        // ignore if schema not ready or Supabase not configured
      }
    };
    load();
  }, [user]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container grid gap-10 py-12">
        <section className="rounded-lg border bg-card p-10 shadow-[var(--shadow-elegant)]">
          <h1 className="mb-3 text-4xl font-bold">Magic: The Gathering Collection Tracker</h1>
          <p className="mb-6 text-muted-foreground">
            Import your collections, manage them, and search across the community.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/search">
              <Button>Search Cards</Button>
            </Link>
            {user ? (
              <>
                <Link to="/collections">
                  <Button variant="secondary">My Collections</Button>
                </Link>
                <Link to="/import">
                  <Button variant="outline">Import CSV</Button>
                </Link>
              </>
            ) : (
              <>
                <Link to="/signup">
                  <Button>Get Started</Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline">Login</Button>
                </Link>
              </>
            )}
          </div>
        </section>

        {user && (
          <section className="grid gap-4 rounded-lg border bg-card p-6">
            <h2 className="text-2xl font-semibold">Your Snapshot</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Collections</div>
                <div className="text-2xl font-bold">{counts.collections}</div>
              </div>
              <div className="rounded-md border p-4">
                <div className="text-sm text-muted-foreground">Cards</div>
                <div className="text-2xl font-bold">{counts.cards}</div>
              </div>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Index;

