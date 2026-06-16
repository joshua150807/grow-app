import { Asset } from 'expo-asset';

export const RATING_ICONS = {
  fire: require('../assets/rating-icons/rating-fire.webp'),
  thumbsUp: require('../assets/rating-icons/rating-thumbs-up.webp'),
  neutral: require('../assets/rating-icons/rating-neutral.webp'),
  thumbsDown: require('../assets/rating-icons/rating-thumbs-down.webp'),
};

export const RATING_ICON_ASSETS = Object.values(RATING_ICONS);

let ratingIconsPreloaded = false;
let ratingIconsPromise = null;

export async function preloadRatingIconAssets() {
  if (ratingIconsPreloaded) return;

  if (!ratingIconsPromise) {
    ratingIconsPromise = Asset.loadAsync(RATING_ICON_ASSETS)
      .then(() => {
        ratingIconsPreloaded = true;
      })
      .catch((err) => {
        ratingIconsPromise = null;
        throw err;
      });
  }

  await ratingIconsPromise;
}
