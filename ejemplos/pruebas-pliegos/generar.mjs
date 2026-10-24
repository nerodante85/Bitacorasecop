#!/usr/bin/env node
// Genera los archivos de prueba a partir de escenarios.mjs (empresas, contratos y pliegos FICTICIOS).
//
//   node ejemplos/pruebas-pliegos/generar.mjs [AAAA-MM-DD]
//
// Sin fecha usa la de hoy. Las fechas de los contratos y el cierre de los procesos son relativos a esa fecha, así que
// conviene volver a generar si pasan meses (un contrato «de hace 2 años» debe seguir dentro de la ventana de 10 años).
// Sin dependencias: SheetJS sale de vendor/ y el PDF de texto se escribe a mano (Helvetica, texto digital).

import { writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { construir, clavesRespaldo, filasExperiencia, hojasFormatoMaestro } from './escenarios.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(AQUI, '..', '..');
const XLSX = createRequire(import.meta.url)(path.join(ROOT, 'vendor', 'xlsx-0.20.3.full.min.js'));

// ---- PDF de texto mínimo ----------------------------------------------------------------------------------
// Una página por cadena de `paginas`. Helvetica con WinAnsi: sirve para las tildes y la ñ (todo el texto es Latin-1).
function pdfDeTexto(titulo, paginas) {
  const ANCHO = 92; // caracteres por línea (Helvetica 11 pt en página carta con márgenes de 60 pt)
  const envolver = txt => {
    const lineas = []; let linea = '';
    txt.split(/\s+/).forEach(p => {
      if ((linea + ' ' + p).trim().length > ANCHO) { lineas.push(linea); linea = p; } else linea = (linea + ' ' + p).trim();
    });
    if (linea) lineas.push(linea);
    return lineas;
  };
  const esc = s => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
  const objetos = []; // cuerpos de los objetos 1..n (índice 0 = objeto 1)
  const agregar = cuerpo => { objetos.push(cuerpo); return objetos.length; };
  const catalogo = agregar(''), arbol = agregar(''), fuente = agregar('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const hijos = [];
  paginas.forEach((pg, i) => {
    const lineas = ['DOCUMENTO FICTICIO PARA PRUEBAS — pág. ' + (i + 1) + '/' + paginas.length].concat([''], envolver(pg));
    let flujo = 'BT\n/F1 11 Tf\n14 TL\n60 740 Td\n';
    lineas.forEach(l => { flujo += '(' + esc(l) + ') Tj\nT*\n'; });
    flujo += 'ET';
    const bytes = Buffer.from(flujo, 'latin1');
    const contenido = agregar({ flujo: bytes });
    const pagina = agregar('<< /Type /Page /Parent ' + arbol + ' 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 ' + fuente + ' 0 R >> >> /Contents ' + contenido + ' 0 R >>');
    hijos.push(pagina + ' 0 R');
  });
  objetos[catalogo - 1] = '<< /Type /Catalog /Pages ' + arbol + ' 0 R >>';
  objetos[arbol - 1] = '<< /Type /Pages /Kids [' + hijos.join(' ') + '] /Count ' + hijos.length + ' >>';
  const partes = [Buffer.from('%PDF-1.4\n', 'latin1')]; const offsets = []; let largo = partes[0].length;
  objetos.forEach((o, i) => {
    offsets.push(largo);
    const b = (typeof o === 'string')
      ? Buffer.from((i + 1) + ' 0 obj\n' + o + '\nendobj\n', 'latin1')
      : Buffer.concat([Buffer.from((i + 1) + ' 0 obj\n<< /Length ' + o.flujo.length + ' >>\nstream\n', 'latin1'), o.flujo, Buffer.from('\nendstream\nendobj\n', 'latin1')]);
    partes.push(b); largo += b.length;
  });
  let xref = 'xref\n0 ' + (objetos.length + 1) + '\n0000000000 65535 f \n';
  offsets.forEach(o => { xref += String(o).padStart(10, '0') + ' 00000 n \n'; });
  xref += 'trailer\n<< /Size ' + (objetos.length + 1) + ' /Root ' + catalogo + ' 0 R >>\nstartxref\n' + largo + '\n%%EOF\n';
  partes.push(Buffer.from(xref, 'latin1'));
  return Buffer.concat(partes);
}

function escribir(destino, contenido) {
  mkdirSync(path.dirname(destino), { recursive: true });
  writeFileSync(destino, contenido);
  console.log('  ' + path.relative(ROOT, destino));
}

const hoy = process.argv[2] || new Date().toISOString().slice(0, 10);
const fict = construir(hoy);
console.log('Generando archivos de prueba (fecha de referencia ' + hoy + ')…');

// Respaldos (con y sin profesionales en «Personal»)
for (const [archivo, opciones] of [['respaldo-empresas-ficticias.json', {}], ['respaldo-sin-personal.json', { sinPersonal: true }]]) {
  const respaldo = { formato: 'bitacora-respaldo', version: 1, generado: new Date(hoy + 'T12:00:00Z').toISOString(), claves: clavesRespaldo(fict, opciones) };
  escribir(path.join(AQUI, archivo), JSON.stringify(respaldo, null, 1) + '\n');
}

// Pliegos en PDF
fict.pliegos.forEach(p => escribir(path.join(AQUI, p.archivo), pdfDeTexto(p.titulo, p.paginas)));

// Excel de experiencia de cada empresa (importación clásica)
fict.empresas.filter(e => e.contratos.length).forEach(e => {
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet(filasExperiencia(e)), 'Contratos');
  escribir(path.join(AQUI, 'experiencia-por-empresa', e.id + '.xlsx'), XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }));
});

// Formato Maestro de Experiencia (todas las empresas en un libro)
{
  const hojas = hojasFormatoMaestro(fict);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, XLSX.utils.aoa_to_sheet([['Formato Maestro de Experiencia FICTICIO — solo para pruebas de Bitácora SECOP']]), 'LEEME');
  Object.keys(hojas).forEach(n => { if (hojas[n].length) XLSX.utils.book_append_sheet(libro, XLSX.utils.json_to_sheet(hojas[n]), n); });
  escribir(path.join(AQUI, 'Formato_Maestro_ficticio.xlsx'), XLSX.write(libro, { type: 'buffer', bookType: 'xlsx' }));
}
console.log('Listo.');
