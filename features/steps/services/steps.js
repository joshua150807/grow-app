import { supabase } from '../../../services/supabaseClient';
import { getCurrentUserId } from '../../../services/authUser';

function getLocalDateKey() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

export async function upsertSteps(steps) {
  const userId = await getCurrentUserId();
  if (!userId) return;

  const today = getLocalDateKey();

  const { error } = await supabase
    .from('step_counts')
    .upsert(
      {
        user_id: userId,
        date: today,
        steps,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,date' }
    );

  if (error) throw error;
}