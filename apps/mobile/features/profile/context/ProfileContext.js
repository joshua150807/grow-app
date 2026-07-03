import { createContext, useContext } from 'react';

export const StartupProfileContext = createContext(null);

export function useStartupProfile() {
  return useContext(StartupProfileContext);
}