import { Setting, DEFAULT_SETTINGS } from './models.js';

export const SETTING_KEYS = [...Object.keys(DEFAULT_SETTINGS), 'groupDegrees'];

// Ajustes con valores por defecto. `groupDegrees` (licenciaturas con varios grupos) se deduce de los nombres mientras
// nadie lo haya guardado: cualquier licenciatura que mencione "telesecundaria".
export async function loadSettings() {
  const rows = await Setting.find();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) if (SETTING_KEYS.includes(r.key)) out[r.key] = r.value;
  if (!rows.some((r) => r.key === 'groupDegrees')) out.groupDegrees = out.degrees.filter((d) => /telesecundaria/i.test(d));
  return out;
}
