// sql.js ships without types; the tests only need its initialiser.
declare module 'sql.js' {
  const initSqlJs: (config?: { locateFile?: (file: string) => string }) => Promise<unknown>;
  export default initSqlJs;
}
