import { useState } from 'react';

import { ChoiceView } from './setup/ChoiceView';
import { PresetSelector } from './setup/PresetSelector';
import { CustomPlanForm } from './setup/CustomPlanForm';

export function SetupView({ onSave, existingPlan = null, onCancel }) {
  const [mode, setMode] = useState(null);

  const handleBack = () => {
    if (mode) {
      setMode(null);
      return;
    }

    if (onCancel) {
      onCancel();
    }
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
    />
  );
}