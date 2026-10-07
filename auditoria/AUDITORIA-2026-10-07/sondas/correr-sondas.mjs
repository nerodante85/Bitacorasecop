#!/usr/bin/env node
// Arnés de las sondas de auditoría (2026-10-07). NO modifica la app ni las pruebas:
// toma de tests/smoke.mjs solo el extractor del motor real (index.html + evaluacion.js), le agrega
// extraerExigencias/analizarTexto, y corre las sondas de este directorio contra ese motor.
// Uso: node auditoria/AUDITORIA-2026-10-07/sondas/correr-sondas.mjs [archivo-de-sondas.mjs]
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(AQUI, '../../..');
const smoke = readFileSync(path.join(ROOT, 'tests/smoke.mjs'), 'utf8');
const iLog = smoke.indexOf("console.log('Bitácora SECOP — tests de humo");
const iFn = smoke.indexOf('function extractExperienceEngine() {');
const iFin = smoke.indexOf('let expEngine = null;');
if (iLog < 0 || iFn < 0 || iFin < 0) throw new Error('smoke.mjs cambió: actualiza las anclas del arnés de sondas');
let cabecera = smoke.slice(0, iLog).replace(/const ROOT = .*;/, 'const ROOT = ' + JSON.stringify(ROOT) + ';');
let motor = smoke.slice(iFn, iFin)
  .replace("const endB = 'function extraerExigencias(text){';", "const endB = 'function analizarTexto(text){';")
  .replace('return { parsearExcelExperiencia,', 'return { extraerExigencias, extraerParticipacionConsorcio, parsearExcelExperiencia,');
const fakeWorkbookSrc = smoke.slice(smoke.indexOf('function fakeWorkbook(headers, rows) {'), smoke.indexOf('let expEngine = null;'));
const sondas = readFileSync(path.resolve(process.argv[2] || path.join(AQUI, 'sondas-motor.mjs')), 'utf8');
const tmp = path.join(AQUI, '.generado.mjs');
writeFileSync(tmp, cabecera + '\n' + motor + '\nlet expEngine = null;\nexpEngine = extractExperienceEngine();\n' + sondas);
try { execFileSync('node', [tmp], { stdio: 'inherit' }); } finally { unlinkSync(tmp); }
