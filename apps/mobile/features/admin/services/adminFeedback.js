import { supabase } from '../../../services/supabaseClient';

export async function loadAdminFeedbackList(limit = 100) {
  const { data, error } = await supabase.rpc('get_admin_feedback_list', {
    limit_count: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []).map((item, index) => {
    const feedback = item.feedback ?? {};

    return {
      id: String(feedback.id ?? index),
      username: item.username ?? 'Unbekannter User',
      userId: feedback.user_id ?? null,
      type: feedback.feedback_type ?? feedback.type ?? 'Feedback',
      importance: feedback.importance ?? feedback.priority ?? null,
      message: feedback.message ?? feedback.text ?? feedback.feedback_text ?? '',
      imageUrl:
        feedback.image_url ??
        feedback.imageUrl ??
        feedback.public_image_url ??
        feedback.image_path ??
        null,
      status: feedback.status ?? 'new',
      createdAt: feedback.created_at ?? null,
      raw: feedback,
    };
  });
}

export async function deleteAdminFeedback(feedbackId) {
  const { error } = await supabase.rpc('delete_admin_feedback', {
    feedback_id: feedbackId,
  });

  if (error) {
    throw error;
  }
}