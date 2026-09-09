import Link from 'next/link';

type LoginErrorPageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function LoginErrorPage({ searchParams }: LoginErrorPageProps) {
  const { error } = await searchParams;
  const wasCancelled = error === 'AccessDenied' || error === 'OAuthAccountNotLinked';

  return (
    <main className="container d-flex min-vh-100 align-items-center justify-content-center p-4">
      <section className="card shadow-sm p-4 text-center" aria-live="polite">
        <h1 className="h3">Unable to sign in</h1>
        <p className="text-muted mb-4">
          {wasCancelled
            ? 'Google sign-in was cancelled or not approved. You can continue playing as a guest.'
            : 'We could not complete sign-in. Please try again or continue playing as a guest.'}
        </p>
        <Link className="btn btn-primary" href="/">Continue as guest</Link>
      </section>
    </main>
  );
}
