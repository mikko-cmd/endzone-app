import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function DraftPage() {
  const supabase = createClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    redirect('/auth/login');
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <h1 
          className="text-4xl font-normal mb-8"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          [draft assistant]
        </h1>
        <div 
          className="bg-black border border-white/20 p-6"
          style={{ fontFamily: 'Consolas, monospace' }}
        >
          <p className="text-gray-400">draft assistant coming soon...</p>
        </div>
      </div>
    </div>
  );
}
