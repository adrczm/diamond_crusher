// Device authentication for the optional app lock (PRIV-010 to PRIV-013).
import * as LocalAuthentication from 'expo-local-authentication';

export const auth = {
  async available(): Promise<boolean> {
    const level = await LocalAuthentication.getEnrolledLevelAsync();
    return level !== LocalAuthentication.SecurityLevel.NONE;
  },
  async authenticate(prompt: string): Promise<boolean> {
    const r = await LocalAuthentication.authenticateAsync({ promptMessage: prompt, disableDeviceFallback: false, cancelLabel: 'Cancel' });
    return r.success;
  },
};
