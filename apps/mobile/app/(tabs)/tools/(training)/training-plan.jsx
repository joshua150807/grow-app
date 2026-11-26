import TrainingOverviewScreen from "../../../../features/tools/training/screens/TrainingOverviewScreen";
import TrainingV2HubScreen from "../../../../features/tools/training-v2/screens/TrainingV2HubScreen";

const TrainingPlanScreen = process.env.EXPO_PUBLIC_TRAINING_V2_ENABLED === 'true'
  ? TrainingV2HubScreen
  : TrainingOverviewScreen;

export default TrainingPlanScreen;
