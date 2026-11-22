/** Las migraciones se pueden correr de nuevo sobre una base que ya las tiene (SQL Editor). */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { crearBase } from './db';

it('todas las migraciones se pueden volver a correr sin error', async () => {
  const db = await crearBase();
  const dir = join(__dirname, '..', 'migrations');
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
    await expect(db.exec(readFileSync(join(dir, f), 'utf8'))).resolves.toBeDefined();
  }
});
