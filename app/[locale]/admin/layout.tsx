import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { authorizeAdminHeaders } from '../../../lib/adminAuth';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const authorization = await authorizeAdminHeaders(await headers());

    if (!authorization.ok) notFound();

    return children;
}
