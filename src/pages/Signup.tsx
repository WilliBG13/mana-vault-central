import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

const Signup = () => {
  const { signUp } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await signUp(email.trim(), password);
    setLoading(false);
    if ((res as any)?.error) {
      toast({ title: "Signup failed", description: (res as any).error });
    } else {
      toast({ title: "Check your email", description: "Confirm your account to sign in." });
      nav("/login");
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-elegant)]">
        <CardHeader>
          <CardTitle>Create Account</CardTitle>
          <CardDescription>Start tracking your MTG collection</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Sign Up"}
            </Button>
            <p className="text-sm text-muted-foreground">
              Already have an account? <Link to="/login" className="underline">Sign in</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
};

export default Signup;
