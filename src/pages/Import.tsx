import { useState } from "react";
import Navbar from "@/components/Layout/Navbar";
import Footer from "@/components/Layout/Footer";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import Papa from "papaparse";
import { toast } from "@/hooks/use-toast";
import { getSupabase } from "@/lib/supabaseClient";
import { useAuth } from "@/context/AuthContext";

interface ParsedRow {
  card_name: string;
  quantity: number;
  set_name?: string | null;
}

const normalizeRow = (row: Record<string, any>): ParsedRow | null => {
  // Detect by common headers
  const keys = Object.keys(row).reduce<Record<string, string>>((acc, k) => {
    acc[k.toLowerCase().trim()] = k;
    return acc;
  }, {});

  const nameKey = keys["name"]; // shared
  const qtyKey = keys["quantity"] || keys["count"];
  const setKey = keys["edition"] || keys["set"] || keys["set name"];

  if (!nameKey || !qtyKey) return null;

  const name = String(row[nameKey]).trim();
  const qty = Number(row[qtyKey]);
  const set = setKey ? String(row[setKey]).trim() : null;

  if (!name || Number.isNaN(qty)) return null;
  return { card_name: name, quantity: Math.max(0, Math.floor(qty)), set_name: set };
};

const Import = () => {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [name, setName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleParse = () => {
    if (!file) return;
    setParsing(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: ParsedRow[] = [];
        for (const r of results.data as any[]) {
          const n = normalizeRow(r);
          if (n) parsed.push(n);
        }
        setRows(parsed);
        setParsing(false);
        toast({ title: `Parsed ${parsed.length} rows` });
      },
      error: (err) => {
        setParsing(false);
        toast({ title: "Failed to parse CSV", description: err.message });
      },
    });
  };

  const handleImport = async () => {
    if (!user) return;
    if (!name.trim()) {
      toast({ title: "Enter a collection name" });
      return;
    }
    if (rows.length === 0) {
      toast({ title: "No rows to import" });
      return;
    }
    setImporting(true);
    const supabase = getSupabase();
    const { data: col, error: cErr } = await supabase
      .from("collections")
      .insert({ name: name.trim(), user_id: user.id, imported_at: new Date().toISOString() })
      .select("id")
      .single();
    if (cErr || !col) {
      setImporting(false);
      toast({ title: "Failed creating collection", description: cErr?.message });
      return;
    }

    const payload = rows.map((r) => ({ ...r, collection_id: col.id }));
    const { error: kErr } = await supabase.from("cards").insert(payload);
    if (kErr) {
      // cleanup
      await supabase.from("collections").delete().eq("id", col.id);
      toast({ title: "Import failed", description: kErr.message });
    } else {
      toast({ title: "Import complete", description: `${rows.length} rows imported` });
      setFile(null);
      setRows([]);
      setName("");
    }
    setImporting(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="container py-10">
        <Card>
          <CardHeader>
            <CardTitle>Import CSV</CardTitle>
            <CardDescription>Supports Manabox and Moxfield formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 sm:max-w-md">
              <label className="text-sm">Collection name</label>
              <Input placeholder="e.g. Modern Staples" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-2 sm:max-w-md">
              <label className="text-sm">Upload CSV</label>
              <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-3">
              <Button onClick={handleParse} disabled={!file || parsing}>
                {parsing ? "Parsing..." : "Parse CSV"}
              </Button>
              <Button onClick={handleImport} variant="secondary" disabled={rows.length === 0 || importing || !name.trim()}>
                {importing ? "Importing..." : "Confirm Import"}
              </Button>
            </div>

            {rows.length > 0 && (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="p-2">Card</th>
                      <th className="p-2">Set</th>
                      <th className="p-2">Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((r, i) => (
                      <tr key={i} className="border-t">
                        <td className="p-2">{r.card_name}</td>
                        <td className="p-2">{r.set_name || "-"}</td>
                        <td className="p-2">{r.quantity}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {rows.length > 100 && (
                  <p className="p-3 text-xs text-muted-foreground">Showing first 100 rows of {rows.length}</p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default Import;
