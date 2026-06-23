import { useState } from 'react';
import { router } from 'expo-router';

import { ChoiceView } from './setup/ChoiceView';
import { PresetSelector } from './setup/PresetSelector';
import { CustomPlanForm } from './setup/CustomPlanForm';

export function SetupView({ onSave, existingPlan = null, onCancel, backLabel }) {
  const [mode, setMode] = useState(null);
  const resolvedBackLabel = backLabel || (existingPlan ? 'Trainingsplan' : 'Tools');

  const handleBack = () => {
    if (mode) {
      setMode(null);
      return;
    }

    if (onCancel) {
      onCancel();
      return;
    }

    router.back();
  };

  if (mode === 'custom') {
    return (
      <CustomPlanForm
        onSave={onSave}
        onBack={handleBack}
      />
    );
  }

  if (mode === 'presets') {
    return (
      <PresetSelector
        onSave={onSave}
        onBack={handleBack}
        existingPlan={existingPlan}
      />
    );
  }

  return (
    <ChoiceView
      onSelectPresets={() => setMode('presets')}
      onSelectCustom={() => setMode('custom')}
      onBack={handleBack}
      backLabel={resolvedBackLabel}
    />
  );
}