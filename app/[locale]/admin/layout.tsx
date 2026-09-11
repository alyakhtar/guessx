import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { authorizeAdmin } from '../../../lib/adminAuth';
import { auth } from '../../../auth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await auth().catch(() => null);
    const authorization = await authorizeAdmin(await headers(), session);

    if (!authorization.ok) notFound();

    return children;
}
