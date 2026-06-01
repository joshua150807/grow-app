import { supabase } from "../../../services/supabaseClient";

async function getCurrentUserId() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return user?.id ?? null;
}

function shuffleArray(array) {
  const shuffled = [...array];

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const randomIndex = Math.floor(Math.random() * (i + 1));

    const temp = shuffled[i];
    shuffled[i] = shuffled[randomIndex];
    shuffled[randomIndex] = temp;
  }

  return shuffled;
}

function mapVideos(videos, bookmarkedVideoIds = []) {
  return (videos ?? [])
    .filter((video) => video?.id && video?.video_url)
    .map((video) => ({
      id: String(video.id),
      title: video.title ?? "",
      source: video.video_url,
      thumbnail: video.thumbnail_url ?? null,
      saved: bookmarkedVideoIds.includes(video.id),
    }));
}

export async function getActiveVideos() {
  const userId = await getCurrentUserId();

  const { data: videos, error: videosError } = await supabase
    .from("videos")
    .select("*")
    .eq("is_active", true);

  if (videosError) {
    throw videosError;
  }

  const activeVideos = (videos ?? []).filter(
    (video) => video?.id && video?.video_url,
  );

  if (activeVideos.length === 0) {
    return [];
  }

  // Ohne eingeloggten User können wir keinen persönlichen Verlauf filtern.
  if (!userId) {
    return shuffleArray(mapVideos(activeVideos));
  }

  const [bookmarksResult, viewsResult, ratingsResult] = await Promise.all([
    supabase.from("video_bookmarks").select("video_id").eq("user_id", userId),

    supabase.from("video_views").select("video_id").eq("user_id", userId),

    supabase.from("video_ratings").select("video_id").eq("user_id", userId),
  ]);

  if (bookmarksResult.error) {
    throw bookmarksResult.error;
  }

  if (viewsResult.error) {
    throw viewsResult.error;
  }

  if (ratingsResult.error) {
    throw ratingsResult.error;
  }

  const bookmarkedVideoIds = (bookmarksResult.data ?? []).map(
    (bookmark) => bookmark.video_id,
  );

  // Ein Video gilt als gesehen, wenn es entweder:
  // 1. in video_views steht, also angeschaut wurde
  // 2. in video_ratings steht, also bewertet wurde
  //
  // Dadurch tauchen bewertete Videos nicht wieder im normalen Feed auf,
  // solange es noch ungesehene aktive Videos gibt.
  const seenVideoIds = new Set([
    ...(viewsResult.data ?? []).map((view) => view.video_id),
    ...(ratingsResult.data ?? []).map((rating) => rating.video_id),
  ]);

  const unseenVideos = activeVideos.filter(
    (video) => !seenVideoIds.has(video.id),
  );

  // Regel:
  // Solange es ungesehene Videos gibt, bekommt der User nur diese.
  // Erst wenn alle aktiven Videos gesehen/bewertet wurden,
  // wird wieder aus allen aktiven Videos gemischt.
  const videosForFeed = unseenVideos.length > 0 ? unseenVideos : activeVideos;

  return shuffleArray(mapVideos(videosForFeed, bookmarkedVideoIds));
}

export async function getSavedVideos() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("video_bookmarks")
    .select(
      `
      video_id,
      created_at,
      videos (
        id,
        title,
        video_url,
        thumbnail_url,
        is_active
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return (data ?? [])
    .filter((bookmark) => {
      const video = bookmark.videos;

      return video && video.is_active && video.video_url;
    })
    .map((bookmark) => ({
      id: bookmark.videos.id,
      title: bookmark.videos.title,
      source: bookmark.videos.video_url,
      thumbnail: bookmark.videos.thumbnail_url,
      saved: true,
      savedAt: bookmark.created_at,
    }));
}

export async function getSavedVideoIds() {
  const userId = await getCurrentUserId();

  if (!userId) {
    return [];
  }

  const { data, error } = await supabase
    .from("video_bookmarks")
    .select("video_id")
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  return (data ?? []).map((bookmark) => bookmark.video_id);
}

export async function toggleVideoBookmark(videoId, currentlySaved) {
  const userId = await getCurrentUserId();

  if (!userId) {
    throw new Error("Kein eingeloggter User gefunden.");
  }

  if (currentlySaved) {
    const { error } = await supabase
      .from("video_bookmarks")
      .delete()
      .eq("user_id", userId)
      .eq("video_id", videoId);

    if (error) {
      throw error;
    }

    return false;
  }

  const { error } = await supabase.from("video_bookmarks").upsert(
    {
      user_id: userId,
      video_id: videoId,
    },
    {
      onConflict: "user_id,video_id",
    },
  );

  if (error) {
    throw error;
  }

  return true;
}
