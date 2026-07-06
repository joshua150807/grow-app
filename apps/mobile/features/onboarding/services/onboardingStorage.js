import AsyncStorage from '@react-native-async-storage/async-storage';

const ONBOARDING_VERSION = 'v1';
const PROMPT_SEEN_KEY = `@grow/onboarding/${ONBOARDING_VERSION}/promptSeen`;
const TUTORIAL_FINISHED_KEY = `@grow/onboarding/${ONBOARDING_VERSION}/tutorialFinished`;

export async function hasSeenOnboardingPrompt() {
  const value = await AsyncStorage.getItem(PROMPT_SEEN_KEY);
  return value === 'true';
}

export async function markOnboardingPromptSeen() {
  await AsyncStorage.setItem(PROMPT_SEEN_KEY, 'true');
}

export async function hasFinishedTutorial() {
  const value = await AsyncStorage.getItem(TUTORIAL_FINISHED_KEY);
  return value === 'true';
}

export async function markTutorialFinished() {
  await AsyncStorage.setItem(TUTORIAL_FINISHED_KEY, 'true');
}

export async function resetOnboardingForTesting() {
  await AsyncStorage.multiRemove([PROMPT_SEEN_KEY, TUTORIAL_FINISHED_KEY]);
}
