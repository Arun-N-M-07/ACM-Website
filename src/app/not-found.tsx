export default function NotFound() {
  return (
    <main className="archive-page not-found">
      <p className="kicker">404 · Off the map</p>
      <h1 className="archive-title">This room doesn’t exist.</h1>
      <p>
        <a className="text-link" href="/">
          Back to the red building →
        </a>{' '}
        ·{' '}
        <a className="text-link" href="/archive">
          The chapter in print
        </a>
      </p>
    </main>
  );
}
