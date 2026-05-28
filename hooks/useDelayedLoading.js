import { useEffect, useState } from 'react';

export function useDelayedLoading(loading, delay = 700) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let timeoutId;

    if (loading) {
      timeoutId = setTimeout(() => {
        setVisible(true);
      }, delay);
    } else {
      setVisible(false);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [loading, delay]);

  return visible;
}
