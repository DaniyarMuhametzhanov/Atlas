// Минимальное описание API mapshaper, которое используют скрипты подготовки данных
declare module 'mapshaper' {
  const mapshaper: {
    applyCommands(commands: string, input?: Record<string, unknown>): Promise<Record<string, Buffer | string>>;
  };
  export default mapshaper;
}
