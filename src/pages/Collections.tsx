import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getSupabase } from "@/lib/supabaseClient";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

const fetchCollections = async (userId: string) => {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("collections")
    .select("id, name, imported_at")
    .eq("user_id", userId)
    .order("imported_at", { ascending: false });
  if (error) throw error;
  return data || [];
};

const Collections = () => {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({
    queryKey: ["collections", user?.id],
    queryFn: () => fetchCollections(user!.id),
    enabled: !!user?.id,
  });

  const onDelete = async (id: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.from("collections").delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message });
    else {
      toast({ title: "Collection deleted" });
      qc.invalidateQueries({ queryKey: ["collections", user?.id] });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Collections</h1>
          <Button onClick={() => nav("/import")}>Import CSV</Button>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i} className="h-40 animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((c) => (
              <Card key={c.id}>
                <CardHeader>
                  <CardTitle>{c.name}</CardTitle>
                  <CardDescription>Imported {new Date(c.imported_at).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">Click to view contents.</p>
                </CardContent>
                <CardFooter className="flex items-center justify-between">
                  <Link to={`/collections/${c.id}`}>
                    <Button variant="secondary">Open</Button>
                  </Link>
                  <Button variant="destructive" onClick={() => onDelete(c.id)}>
                    Delete
                  </Button>
                </CardFooter>
              </Card>
            ))}
            {data.length === 0 && (
              <Card className="col-span-full">
                <CardHeader>
                  <CardTitle>No collections yet</CardTitle>
                  <CardDescription>Import a CSV to create your first collection.</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default Collections;
