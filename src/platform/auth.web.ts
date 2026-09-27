// Web build: no device authentication in the browser, so the optional app lock is offered on phones only.
export const auth = {
  async available(): Promise<boolean> {
    return false;
  },
  async authenticate(_prompt: string): Promise<boolean> {
    return false;
  },
};
