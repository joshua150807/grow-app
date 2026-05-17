import { StyleSheet } from 'react-native';

import { trainingBaseStyles } from './trainingBaseStyles';
import { trainingSetupStyles } from './trainingSetupStyles';
import { trainingOverviewStyles } from './trainingOverviewStyles';
import { trainingModalStyles } from './trainingModalStyles';
import { trainingSessionStyles } from './trainingSessionStyles';
import { trainingMainStyles } from './trainingMainStyles';

export const styles = StyleSheet.create({
  ...trainingBaseStyles,
  ...trainingSetupStyles,
  ...trainingOverviewStyles,
  ...trainingModalStyles,
  ...trainingSessionStyles,
  ...trainingMainStyles,
});
