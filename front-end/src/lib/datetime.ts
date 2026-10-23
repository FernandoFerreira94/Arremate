/** Brasil não tem horário de verão desde 2019: Brasília é UTC−3 fixo. */
const BRT_OFFSET_HOURS = 3;

/** "AAAA-MM-DDTHH:mm" em horário de Brasília → ISO UTC determinístico, ou null. */
export function brtInputToUtcIso(value: string): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map((part) => Number.parseInt(part, 10));
  const utc = new Date(Date.UTC(year, month - 1, day, hour + BRT_OFFSET_HOURS, minute));
  const check = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59) return null;
  return utc.toISOString();
}

const formatter = new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** ISO UTC → "dd/mm/aaaa hh:mm" em horário de Brasília. */
export function formatBrt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return formatter.format(date).replace(",", "");
}
