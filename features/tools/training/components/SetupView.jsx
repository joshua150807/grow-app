import { useState } from 'react';

import { ChoiceView } from './setup/ChoiceView';
import { PresetSelector } from './setup/PresetSelector';
import { CustomPlanForm } from './setup/CustomPlanForm';

export function SetupView({ onSave }) {
  const [mode, setMode] = useState(null);

  if (mode === 'custom') {
    return <CustomPlanForm onSave={onSave} onBack={() => setMode(null)} />;
  }

  if (mode === 'presets') {
    return <PresetSelector onSave={onSave} onBack={() => setMode(null)} />;
  }

  return (
    <ChoiceView
      onSelectPresets={() => setMode('presets')}
      onSelectCustom={() => setMode('custom')}
    />
  );
}