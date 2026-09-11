import { redirect } from 'next/navigation';

import { auth } from '../../../auth';
import PlayerStatsPage from '../../../components/PlayerStatsPage';

export default async function StatsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const session = await auth().catch(() => null);
  if (!session?.user?.id) redirect(`/${locale}`);

  return <PlayerStatsPage />;
}
