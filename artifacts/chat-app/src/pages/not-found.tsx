export default function NotFound() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-muted-foreground mb-8">Signal lost. Page not found.</p>
        <a href="/" className="text-primary hover:underline">Return to safety</a>
      </div>
    </div>
  );
}
