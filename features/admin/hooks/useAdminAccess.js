import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';

import { supabase } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/authUser';

const ADMIN_ROLES = ['ceo', 'admin'];

export default function useAdminAccess() {
  const [isCheckingAccess, setIsCheckingAccess] = useState(true);
  const [hasAdminAccess, setHasAdminAccess] = useState(false);
  const [adminRole, setAdminRole] = useState(null);
  const [accessError, setAccessError] = useState(null);
  const activeRequestRef = useRef(0);

  const checkAdminAccess = useCallback(async () => {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    try {
      setIsCheckingAccess(true);
      setAccessError(null);

      const userId = await getCurrentUserId();

      if (requestId !== activeRequestRef.current) return;

      if (!userId) {
        setHasAdminAccess(false);
        setAdminRole(null);
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();

      if (requestId !== activeRequestRef.current) return;

      if (profileError) {
        throw profileError;
      }

      const role = profile?.role ?? 'user';
      const allowed = ADMIN_ROLES.includes(role);

      setAdminRole(role);
      setHasAdminAccess(allowed);
    } catch (error) {
      if (requestId === activeRequestRef.current) {
        setHasAdminAccess(false);
        setAdminRole(null);
        setAccessError('Admin-Zugriff konnte nicht geprüft werden.');
      }
    } finally {
      if (requestId === activeRequestRef.current) {
        setIsCheckingAccess(false);
      }
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      checkAdminAccess();

      return () => {
        activeRequestRef.current += 1;
      };
    }, [checkAdminAccess])
  );

  return {
    isCheckingAccess,
    hasAdminAccess,
    adminRole,
    accessError,
    refreshAdminAccess: checkAdminAccess,
  };
}
