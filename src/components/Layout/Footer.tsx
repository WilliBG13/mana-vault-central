const Footer = () => {
  return (
    <footer className="mt-16 border-t">
      <div className="container py-6 text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} MTG Collection Tracker</p>
      </div>
    </footer>
  );
};

export default Footer;
