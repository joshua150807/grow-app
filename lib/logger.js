import Constants from 'expo-constants';

const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : false;
const enableProductionLogs = Constants?.expoConfig?.extra?.enableProductionLogs === true;

function shouldLog(level) {
  if (isDev || enableProductionLogs) return true;
  return level === 'error';
}

export const logger = {
  debug: (...args) => {
    if (shouldLog('debug')) console.log(...args);
  },
  info: (...args) => {
    if (shouldLog('info')) console.info(...args);
  },
  warn: (...args) => {
    if (shouldLog('warn')) console.warn(...args);
  },
  error: (...args) => {
    if (shouldLog('error')) console.error(...args);
  },
};

export default logger;
