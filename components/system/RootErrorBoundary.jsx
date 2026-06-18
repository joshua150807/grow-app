import { logger } from '../../lib/logger';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from '../../constants/colors';
import { s, sv, sf } from '../../constants/layout';
import PressableScale from '../ui/PressableScale';

export default class RootErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorKey: 0 };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    logger.debug('[RootErrorBoundary] Ein UI-Fehler wurde abgefangen:', error, info?.componentStack);
  }

  handleRetry = () => {
    this.setState((previous) => ({
      hasError: false,
      errorKey: previous.errorKey + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="warning-outline" size={s(32)} color={COLORS.errorLight} />
            </View>

            <Text style={styles.title}>Etwas ist schiefgelaufen</Text>
            <Text style={styles.subtitle}>
              Grow hat einen unerwarteten UI-Fehler abgefangen. Du kannst den Screen direkt neu laden.
            </Text>

            <PressableScale
              onPress={this.handleRetry}
              style={styles.button}
              activeScale={0.975}
              activeOpacity={0.88}
              haptic="light"
            >
              <Text style={styles.buttonText}>Screen neu laden</Text>
            </PressableScale>
          </View>
        </View>
      );
    }

    return <React.Fragment key={this.state.errorKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(22),
  },
  card: {
    width: '100%',
    maxWidth: s(360),
    alignItems: 'center',
    paddingVertical: sv(30),
    paddingHorizontal: s(20),
    borderRadius: s(22),
    borderWidth: 1,
    borderColor: 'rgba(255,122,122,0.25)',
    backgroundColor: 'rgba(212,106,106,0.08)',
    gap: sv(10),
  },
  iconCircle: {
    width: s(58),
    height: s(58),
    borderRadius: s(29),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(212,106,106,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,122,0.25)',
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: sf(18),
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: COLORS.textDim,
    fontSize: sf(13),
    lineHeight: sf(19),
    textAlign: 'center',
  },
  button: {
    marginTop: sv(8),
    minHeight: sv(42),
    paddingHorizontal: s(18),
    borderRadius: s(12),
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.gold,
  },
  buttonText: {
    color: COLORS.background,
    fontSize: sf(14),
    fontWeight: '800',
  },
});
