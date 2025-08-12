import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import DraftAssistant from '@/components/DraftAssistant';

export default async function DraftPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="p-4 pb-0">
        <div className="flex items-center space-x-4 mb-6">
          <Link
            href="/tools"
            className="inline-flex items-center text-white hover:text-gray-300 transition-colors"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            <ChevronLeft size={20} className="mr-2" />
            [back to ai tools]
          </Link>

          <h1
            className="text-3xl sm:text-4xl font-normal"
            style={{ fontFamily: 'Consolas, monospace' }}
          >
            [draft assistant]
          </h1>
        </div>
      </div>

      <DraftAssistant />
    </div>
  );
}
