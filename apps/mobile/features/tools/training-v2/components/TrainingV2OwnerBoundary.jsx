import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { supabase } from '../../../../services/supabaseClient';
import { TrainingV2StateView } from './TrainingV2StateView';

// Remount private training screens on an account transition, including A -> B -> A.
// This also runs their request cleanups and removes old notes/plan/editor state.
export function TrainingV2OwnerBoundary({ children }) {
  const [scope, setScope] = useState(null);
  const [authError, setAuthError] = useState(null);
  const [attempt, setAttempt] = useState(0);
  const ownerRef = useRef(undefined);
  const generationRef = useRef(0);
  useEffect(() => {
    let mounted = true;
    const apply = (owner) => {
      if (!mounted) return;
      setAuthError(null);
      if (owner === ownerRef.current) return;
      ownerRef.current = owner;
      generationRef.current += 1;
      setScope({ owner, generation: generationRef.current });
    };
    const generation = generationRef.current;
    const { data } = supabase.auth.onAuthStateChange((_event, session) => apply(session?.user?.id ?? null));
    void supabase.auth.getSession().then(({ data: current, error }) => {
      if (error) throw error;
      if (generation === generationRef.current) apply(current?.session?.user?.id ?? null);
    }).catch(() => {
      if (mounted && generation === generationRef.current) setAuthError(new Error('Deine lokale Anmeldung konnte nicht gelesen werden. Bitte versuche es erneut.'));
    });
    return () => { mounted = false; data?.subscription?.unsubscribe(); };
  }, [attempt]);
  if (authError) return <TrainingV2StateView error={authError} onRetry={() => setAttempt((value) => value + 1)} />;
  if (!scope?.owner) return null;
  return <View key={`${scope.owner}:${scope.generation}`} style={{ flex: 1 }}>{children}</View>;
}
