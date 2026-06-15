import { decode } from 'base64-arraybuffer';
import { supabase } from '../../../services/supabaseClient';

function getSafeFeedbackFileExtension(fileName, mimeType) {
  const rawExt = fileName?.split('.').pop()?.toLowerCase();

  if (rawExt && /^[a-z0-9]+$/.test(rawExt)) {
    return rawExt;
  }

  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'image/webp') return 'webp';

  return 'jpg';
}

export async function uploadFeedbackImage({ selectedImage, userId }) {
  if (!selectedImage) {
    return { imageUrl: null, imagePath: null };
  }

  if (!selectedImage.base64) {
    throw new Error('Feedback image is missing base64 data.');
  }

  const fileExt = getSafeFeedbackFileExtension(
    selectedImage.fileName,
    selectedImage.mimeType
  );
  const safeUserId = userId || 'anonymous';
  const filePath = `${safeUserId}/${Date.now()}.${fileExt}`;

  const arrayBuffer = decode(selectedImage.base64);

  const { error: uploadError } = await supabase.storage
    .from('feedback-images')
    .upload(filePath, arrayBuffer, {
      contentType: selectedImage.mimeType || 'image/jpeg',
      upsert: false,
    });

  if (uploadError) {
    throw uploadError;
  }

  const { data } = supabase.storage
    .from('feedback-images')
    .getPublicUrl(filePath);

  return {
    imageUrl: data?.publicUrl ?? null,
    imagePath: filePath,
  };
}

async function deleteUploadedFeedbackImage(imagePath) {
  if (!imagePath) return;

  const { error } = await supabase.storage
    .from('feedback-images')
    .remove([imagePath]);

  if (error) {
    console.log('Feedback-Bild konnte nach fehlgeschlagenem Insert nicht bereinigt werden:', error);
  }
}

async function awardFeedbackGrowPoints(userId) {
  if (!userId) {
    return false;
  }

  try {
    const { data: awarded, error } = await supabase.rpc('award_feedback_points');

    if (error) {
      throw error;
    }

    return Boolean(awarded);
  } catch (error) {
    console.log('Grow Points für Feedback konnten nicht vergeben werden:', error);
    return false;
  }
}


export async function sendFeedback({
  userId,
  selectedType,
  selectedImportance,
  text,
  selectedImage,
}) {
  const trimmedText = text.trim();

  if (!userId) {
    throw new Error('Feedback userId is missing.');
  }

  if (!trimmedText) {
    throw new Error('Feedback text is empty.');
  }

  let imageUrl = null;
  let imagePath = null;

  if (selectedImage) {
    const uploadResult = await uploadFeedbackImage({
      selectedImage,
      userId,
    });

    imageUrl = uploadResult.imageUrl;
    imagePath = uploadResult.imagePath;
  }

  const { error: feedbackError } = await supabase.from('feedback').insert({
    user_id: userId,
    feedback_type: selectedType,
    importance: selectedImportance,
    message: trimmedText,
    image_url: imageUrl,
    image_path: imagePath,
  });

  if (feedbackError) {
    await deleteUploadedFeedbackImage(imagePath);
    throw feedbackError;
  }

  const pointsAwarded = await awardFeedbackGrowPoints(userId);

  return { pointsAwarded };
}
