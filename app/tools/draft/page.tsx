import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import SimpleDraftRoom from '@/components/SimpleDraftRoom';

export default async function DraftPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header - only this has padding */}
      <div className="p-4 sm:p-8 pb-0">
        <div className="w-full max-w-7xl mx-auto">
          <Link
            href="/tools"
            className="inline-flex items-center text-white hover:text-gray-300 mb-6 transition-colors"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <ChevronLeft size={20} className="mr-2" />
            [back to ai tools]
          </Link>

          <header className="mb-6">
            <h1
              className="text-3xl sm:text-4xl font-normal mb-2"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              [draft assistant]
            </h1>
            <p
              className="text-lg text-gray-400"
              style={{ fontFamily: 'Consolas, monospace' }}
            >
              visual snake draft board
            </p>
          </header>
        </div>
      </div>

      {/* Full width draft room */}
      <SimpleDraftRoom />
    </div>
  );
}
