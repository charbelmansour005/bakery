import Link from 'next/link';
import LogoutButton from '@/components/admin/LogoutButton';
import { getAdminSession } from '@/lib/session';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'CMS · La Belle Fournée' };

/**
 * Chrome only. The session read here decides whether to show the header, not
 * whether the page may render — each page calls requireAdmin() for that.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();

  return (
    <div className="min-h-dvh bg-slate-50 font-sans text-slate-900">
      {session && (
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
            <div className="flex items-center gap-6">
              <Link href="/admin/products" className="text-sm font-semibold text-slate-900">
                La Belle Fournée CMS
              </Link>
              <nav className="flex items-center gap-5">
                <Link
                  href="/admin/products"
                  className="text-sm text-slate-500 transition hover:text-slate-900"
                >
                  Products
                </Link>
                <Link
                  href="/admin/story"
                  className="text-sm text-slate-500 transition hover:text-slate-900"
                >
                  Hero &amp; Story
                </Link>
                <Link href="/" className="text-sm text-slate-500 transition hover:text-slate-900">
                  View site ↗
                </Link>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <span className="hidden text-sm text-slate-500 sm:inline">{session.username}</span>
              <LogoutButton />
            </div>
          </div>
        </header>
      )}

      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
