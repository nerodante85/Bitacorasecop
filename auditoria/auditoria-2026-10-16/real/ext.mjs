import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { expEngine as E } from './h.mjs';
const require = createRequire(import.meta.url);
const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
const U = '/root/.claude/uploads/2b019993-22e8-5ec0-ac23-67e936083858/';
const FILES = { A: '2cd595cf-pliego_de_condicones_19062026.pdf', B: '3fd712c6-PLIEGO_DE_CONDICIONES_DEFINITIVOS_30072026.pdf', C: '64c52964-1.1_Documento_borrador_pliego_SILOS_V1.pdf', D: '3949f4fa-DOCUMENTO_BASE_-PRE_PLIEGOS_.pdf' };
for (const [k, f] of Object.entries(FILES)) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(readFileSync(U + f)), useSystemFonts: true, verbosity: 0 }).promise;
  const pags = [];
  for (let p = 1; p <= doc.numPages; p++) { const tc = await (await doc.getPage(p)).getTextContent(); pags.push(E.unirItemsDePdf(tc.items)); }
  writeFileSync(`${k}.json`, JSON.stringify(pags));
  console.log(k, doc.numPages, 'págs;', pags.join('\n').length, 'caracteres;', pags.filter(x => x.trim().length < 40).length, 'págs casi vacías');
}
