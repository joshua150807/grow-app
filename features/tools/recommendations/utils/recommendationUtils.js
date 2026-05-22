export const SAVED_RECOMMENDATIONS_STORAGE_KEY = '@grow:saved-recommendations';

export function getRecommendationsByType(recommendations, type) {
  return recommendations.filter((item) => item.type === type);
}

export function getRecommendationTypeConfig(types, type) {
  return types.find((item) => item.key === type) ?? types[0];
}

export function toggleIdInList(list, id) {
  if (list.includes(id)) {
    return list.filter((item) => item !== id);
  }

  return [...list, id];
}
