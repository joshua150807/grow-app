import { useCallback, useState } from 'react';

export function useTrainingV2ArchiveVisibility() {
  const [archivesExpanded, setArchivesExpanded] = useState(false);
  const toggleArchives = useCallback(() => {
    setArchivesExpanded((value) => !value);
  }, []);

  return { archivesExpanded, toggleArchives };
}

