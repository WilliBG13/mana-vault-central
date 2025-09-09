import { Link, NavLink, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

const Navbar = () => {
  const { user, signOut } = useAuth();
  const nav = useNavigate();

  const handleLogout = async () => {
    await signOut();
    nav("/login");
  };

  const active = ({ isActive }: { isActive: boolean }) =>
    isActive ? "text-primary" : "text-muted-foreground hover:text-foreground";

  return (
    <header className="border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <nav className="container flex h-16 items-center justify-between">
        <Link to="/" className="font-semibold">
          MTG Tracker
        </Link>
        <div className="flex items-center gap-6">
          <NavLink to="/" className={active} end>
            Home
          </NavLink>
          {user && (
            <>
              <NavLink to="/collections" className={active}>
                My Collections
              </NavLink>
              <NavLink to="/import" className={active}>
                Import
              </NavLink>
            </>
          )}
          <NavLink to="/search" className={active}>
            Search
          </NavLink>
        </div>
        <div className="flex items-center gap-3">
          {!user ? (
            <div className="flex items-center gap-2">
              <Link to="/login">
                <Button variant="outline">Login</Button>
              </Link>
              <Link to="/signup">
                <Button>Sign up</Button>
              </Link>
            </div>
          ) : (
            <Button onClick={handleLogout} variant="secondary">
              Logout
            </Button>
          )}
        </div>
      </nav>
    </header>
  );
};

export default Navbar;
