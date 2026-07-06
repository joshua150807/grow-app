import { View } from 'react-native';

import { useTourTarget } from '../hooks/useTourTarget';

export default function TourTarget({ id, children, style, pointerEvents }) {
  const target = useTourTarget(id);

  return (
    <View ref={target.ref} onLayout={target.onLayout} style={style} pointerEvents={pointerEvents}>
      {children}
    </View>
  );
}
