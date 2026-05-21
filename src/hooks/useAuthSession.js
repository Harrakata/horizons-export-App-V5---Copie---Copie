import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/**
 * Expose la session Supabase Auth courante (JWT signé côté serveur).
 *
 * @returns { session, user, isLoading }
 *   - session : objet session Supabase ou null
 *   - user    : raccourci vers session.user
 *   - isLoading : true tant que la 1ère récupération n'est pas terminée
 *
 * @example
 *   const { user, isLoading } = useAuthSession();
 *   if (isLoading) return <Spinner />;
 *   if (!user)     return <LoginForm />;
 *   return <App user={user} />;
 */
export function useAuthSession() {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      setSession(data.session ?? null);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (cancelled) return;
      setSession(newSession ?? null);
    });

    return () => {
      cancelled = true;
      subscription?.subscription?.unsubscribe?.();
    };
  }, []);

  return { session, user: session?.user ?? null, isLoading };
}

export default useAuthSession;
