// Sondas adversarias de la auditoría 2026-10-07 -- motor real (index.html + evaluacion.js), sin tocar la app.
// Cada sonda imprime: [ID] OK | HALLAZGO | INFO  -- título -- evidencia ejecutada.
// OK       = el comportamiento es el correcto/conservador.
// HALLAZGO = el motor afirma algo que la fuente no sustenta, o calla algo que debería avisar.
// INFO     = comportamiento por diseño o limitación documentada (se anota para trazabilidad).
const resultados = [];
function sonda(id, titulo, fn) {
  let r;
  try { r = fn(); } catch (e) { r = { v: 'HALLAZGO', ev: 'EXCEPCIÓN: ' + e.message }; }
  resultados.push({ id, v: r.v, titulo });
  console.log('[' + id + '] ' + r.v + ' -- ' + titulo + '\n      ' + String(r.ev).replace(/\n/g, '\n      '));
}
const J = x => JSON.stringify(x);
const exig = t => expEngine.extraerExigencias(t.replace(/\s+/g, ' '));
const umbralDe = (t, k) => { const e = exig(t)[k]; return e ? { valor: e.valor, pct: e.porcentaje, motivo: e.motivo } : null; };

// =====================================================================================
// A. RUP
// =====================================================================================
const RUP_BIEN = `REGISTRO ÚNICO DE PROPONENTES CERTIFICADO. Razón social: CONSTRUCTORA EJEMPLO SAS NIT 900123456-7.
Fecha de renovación: 2026-03-28. CLASIFICACIÓN DE BIENES, OBRAS Y SERVICIOS
72 14 10 03 : SERVICIOS DE CONSTRUCCION DE PUENTES
72 14 10 04 : CONSTRUCCION DE OBRAS CIVILES
95 12 17 01 : INFRAESTRUCTURA VIAL
Certifica: Capacidad jurídica ... Representante legal: JUAN PEREZ C.C. 88245678
INFORMACIÓN FINANCIERA. Fecha de corte: 31/12/2025. ACTIVO CORRIENTE : $ 5.200.000.000 PASIVO CORRIENTE : $ 2.600.000.000
PATRIMONIO : $ 3.100.000.000 ÍNDICE DE LIQUIDEZ : 2,00 ÍNDICE DE ENDEUDAMIENTO : 0,45 RAZÓN DE COBERTURA DE INTERESES : INDETERMINADO
RENTABILIDAD DEL PATRIMONIO : 0,12 CAPITAL DE TRABAJO : $ 2.600.000.000`;

sonda('RUP-01', 'RUP bien formado: clasificación UNSPSC e indicadores se leen tal cual, sin inventar', () => {
  const r = expEngine.parsearRUP(RUP_BIEN);
  const ok = J(r.unspsc) === J(['72141003', '72141004', '95121701']) && /Índice de liquidez: 2,00/.test(r.capK) && /Patrimonio: \$3\.100\.000\.000/.test(r.capK)
    && /cobertura de intereses: INDETERMINADO/.test(r.capK);
  return { v: ok ? 'OK' : 'HALLAZGO', ev: 'unspsc=' + J(r.unspsc) + ' | capK=' + J(r.capK) };
});

sonda('RUP-02', 'RUP SIN el encabezado de clasificación: ¿se inventan códigos UNSPSC desde cédulas/fechas/teléfonos de 8 dígitos?', () => {
  // OCR o un formato distinto del certificado: sin las palabras ancla, el parser recorre TODO el texto con códigos "bare".
  const txt = 'CERTIFICADO RUP Representante legal JUAN PEREZ C.C. 88245678 Fecha de expedición 20260115 Teléfono 31245678 72 14 10 03 : CONSTRUCCION DE PUENTES';
  const r = expEngine.parsearRUP(txt);
  const falsos = r.unspsc.filter(c => c !== '72141003');
  return { v: falsos.length ? 'HALLAZGO' : 'OK', ev: 'unspsc devueltos=' + J(r.unspsc) + ' | códigos que NO son clasificación (cédula/fecha/teléfono)=' + J(falsos) };
});

sonda('RUP-03', 'RUP: fechas con puntos (DD.MM.AA) y numeración "1.25.30" ¿se leen como código UNSPSC?', () => {
  const txt = 'CÓDIGOS UNSPSC 72 14 10 03 : PUENTES. Fecha de inscripción 15.03.24. Renovación 30.03.25. Sección 12.45.67';
  const r = expEngine.parsearRUP(txt);
  const falsos = r.unspsc.filter(c => c !== '72141003');
  return { v: falsos.length ? 'HALLAZGO' : 'OK', ev: 'unspsc=' + J(r.unspsc) + ' | falsos=' + J(falsos) };
});

sonda('RUP-04', 'RUP: "capacidad residual" seguida de un número ajeno (año/artículo) ¿se guarda como K residual de la empresa?', () => {
  const txt = 'CLASIFICACIÓN DE BIENES 72 14 10 03 : PUENTES. La capacidad residual de contratación se calcula según el artículo 2.2.1.1.1.5.2 del Decreto 1082 de 2015.';
  const r = expEngine.parsearRUP(txt);
  return { v: r.capResidual ? 'HALLAZGO' : 'OK', ev: 'capResidual=' + J(r.capResidual) };
});

sonda('RUP-05', 'RUP: "capacidad residual" real en el certificado queda marcada como DECLARADA por la empresa (no como dato del RUP)', () => {
  const txt = 'CLASIFICACIÓN DE BIENES 72 14 10 03 : PUENTES. Capacidad residual de contratación (K residual) : $ 6.000.000.000';
  const r = expEngine.parsearRUP(txt);
  return { v: 'INFO', ev: 'capResidual=' + J(r.capResidual) + ' (el texto de CLAUDE.md dice que el RUP no la trae; si la trae, se copia al campo sin etiqueta de origen)' };
});

sonda('RUP-06', 'RUP: ¿se captura la fecha de corte de los estados financieros y la de renovación (vigencia/firmeza)?', () => {
  const r = expEngine.parsearRUP(RUP_BIEN);
  const tiene = Object.keys(r).some(k => /fecha|vigen|renov|corte/i.test(k));
  return { v: tiene ? 'OK' : 'HALLAZGO', ev: 'campos devueltos por parsearRUP=' + J(Object.keys(r)) + ' -> el RUP del texto trae "Fecha de renovación: 2026-03-28" y "Fecha de corte: 31/12/2025", ninguna se extrae ni se compara con la fecha del proceso.' };
});

sonda('RUP-07', 'Indicador del RUP con formato de miles ambiguo ("1.850") ¿se lee como razón 1,85 o 1850?', () => {
  const r = expEngine.parsearRUP('CLASIFICACIÓN DE BIENES 72 14 10 03 : X. ÍNDICE DE LIQUIDEZ : 1.850 ÍNDICE DE ENDEUDAMIENTO : 0.45');
  const liq = expEngine.leerIndiceDePerfil(r.capK, /[íi]ndice\s+de\s+liquidez/, 'liquidez');
  return { v: 'INFO', ev: 'capK=' + J(r.capK) + ' | leerIndiceDePerfil(liquidez)=' + J(liq) };
});

sonda('RUP-08', 'Índices del RUP con 3 decimales ("1.850", "1,850", "0.450"): ¿se leen como razón (1,85) o como miles (1850)?', () => {
  const lec = (t, tipo) => expEngine.leerIndiceDePerfil(t, /[íi]ndice\s+de\s+liquidez|[íi]ndice\s+de\s+endeudamiento/, tipo);
  const r = { 'liquidez 1.850': lec('Índice de liquidez: 1.850', 'liquidez'), 'liquidez 1,850': lec('Índice de liquidez: 1,850', 'liquidez'), 'liquidez 2.350': lec('Índice de liquidez: 2.350', 'liquidez'), 'endeud. 0.450': lec('Índice de endeudamiento: 0.450', 'endeudamiento') };
  const g = expEngine.compararIndiceConUmbral('Índice de liquidez', { valor: 1.2, porcentaje: false }, r['liquidez 1.850'], '>=', true);
  const mal = Object.entries(r).filter(([k, v]) => v != null && v > 100);
  return { v: mal.length ? 'HALLAZGO' : 'OK', ev: J(r) + ' | gate liquidez ≥ 1,2 con el valor leído de "1.850" -> ' + J(g) + ' (una razón de liquidez de 1850 no es plausible; ni se avisa ni se descarta)' };
});

// =====================================================================================
// B. RUT (lectura por posición x,y de pdf.js)
// =====================================================================================
const it = (str, x, y, pagina = 1) => ({ str, x, y, pagina });
function rutBien(extra) {
  return [
    it('5. Número de Identificación Tributaria (NIT)', 40, 700), it('6. DV', 200, 700), it('7. Primer apellido', 260, 700),
    it('900123456', 40, 686), it('7', 200, 686),
    it('35. Razón social', 40, 660), it('CONSTRUCTORA EJEMPLO SAS', 40, 646),
    it('41. Dirección principal', 40, 620), it('CL 10 5 20 OF 301', 40, 606),
    it('42. Correo electrónico', 40, 580), it('gerencia@ejemplo.co', 40, 566),
    it('46. Código', 40, 540), it('4290', 40, 526),
    it('05- Impto. renta y compl. régimen ordinario', 40, 500)
  ].concat(extra || []);
}
sonda('RUT-01', 'RUT bien formado: NIT, DV, razón social, dirección y actividad se leen tal cual', () => {
  const r = expEngine.parsearRUT(rutBien());
  const ok = r.nit === '900123456' && r.dv === '7' && r.nombre === 'CONSTRUCTORA EJEMPLO SAS' && r.actividadPrincipal === '4290';
  return { v: ok ? 'OK' : 'HALLAZGO', ev: J({ nit: r.nit, dv: r.dv, nombre: r.nombre, direccion: r.direccion, correo: r.correo, act: r.actividadPrincipal }) };
});
sonda('RUT-02', 'RUT: DV incorrecto para el NIT leído (900123456 con DV 9; el correcto es 7) ¿se detecta?', () => {
  const items = rutBien().map(i => (i.str === '7' && i.x === 200 ? Object.assign({}, i, { str: '9' }) : i));
  const r = expEngine.parsearRUT(items);
  // Algoritmo oficial DIAN del dígito de verificación.
  const dv = nit => { const p = [3, 7, 13, 17, 19, 23, 29, 37, 41, 43, 47, 53, 59, 67, 71]; let s = 0; String(nit).split('').reverse().forEach((d, i) => s += +d * p[i]); const m = s % 11; return m > 1 ? 11 - m : m; };
  const aviso = (expEngine.parsearRUT.toString().match(/verific|dv/gi) || []).length;
  return { v: String(dv(r.nit)) !== r.dv ? 'HALLAZGO' : 'OK', ev: 'NIT leído=' + r.nit + ' DV leído=' + r.dv + ' DV calculado=' + dv(r.nit) + ' -> la app guarda "' + r.nit + '-' + r.dv + '" sin validar el DV (control determinístico omitido).' };
});
sonda('RUT-03', 'RUT persona natural (sin razón social): el nombre se arma de apellidos+nombres sin tomar campos vecinos', () => {
  const items = [
    it('31. Primer apellido', 40, 660), it('32. Segundo apellido', 200, 660), it('33. Primer nombre', 340, 660), it('34. Otros nombres', 480, 660),
    it('PEREZ', 40, 646), it('GOMEZ', 200, 646), it('JUAN', 340, 646), it('CARLOS', 480, 646),
    it('35. Razón social', 40, 620), it('36. Nombre comercial', 300, 620), it('FERRETERIA EL PUENTE', 300, 606)
  ];
  const r = expEngine.parsearRUT(items);
  return { v: r.nombre === 'PEREZ GOMEZ JUAN CARLOS' ? 'OK' : 'HALLAZGO', ev: 'nombre=' + J(r.nombre) };
});
sonda('RUT-04', 'RUT: razón social vacía y el renglón de abajo trae el valor de OTRA casilla en la misma columna', () => {
  const items = [it('35. Razón social', 40, 660), it('36. Nombre comercial', 300, 660), it('40. Ciudad/Municipio', 40, 640), it('CUCUTA', 40, 626)];
  const r = expEngine.parsearRUT(items);
  return { v: r.nombre ? 'HALLAZGO' : 'OK', ev: 'nombre=' + J(r.nombre) + ' (esperado null: casilla vacía; el valor "CUCUTA" pertenece a otra casilla)' };
});
sonda('RUT-05', 'RUT: la actividad económica (CIIU) y las responsabilidades se leen, ¿alguna regla del motor las usa?', () => {
  const usos = (html.match(/actividadPrincipal|responsabilidades/g) || []).length;
  const enMotor = /actividadPrincipal|responsabilidades|ciiu/i.test(readFileSync(path.join(ROOT, 'evaluacion.js'), 'utf8'));
  return { v: 'INFO', ev: 'referencias en index.html=' + usos + ' | usadas en evaluacion.js=' + enMotor + ' -> el RUT solo autocompleta datos del perfil; no se contrasta la actividad económica con el objeto del proceso.' };
});

// =====================================================================================
// C. Estudio Previo / Pliego -> umbrales financieros (extraerExigencias, camino por texto)
// =====================================================================================
const casos = [
  ['EP-01', 'Indicadores listados seguidos (LP-008)', 'Índice de liquidez ≥ 1,2 Índice de endeudamiento ≤ 0,70 Razón de cobertura de intereses ≥ 1,0 Capital de trabajo Definido en el documento base', { liquidez: 1.2, endeudamiento: 0.7, cobertura: 1 }],
  ['EP-02', 'Tabla aplanada con operador en palabras', 'Indicador Índice requerido Índice de Liquidez Mayor o igual a 1.5 Nivel de Endeudamiento Menor o igual a 65%', { liquidez: 1.5, endeudamiento: 0.65 }],
  ['EP-03', 'Fórmula con barra antes del umbral', 'Índice de liquidez (Activo corriente / Pasivo corriente) mayor o igual a 1,8. Índice de endeudamiento (Pasivo total / Activo total) menor o igual a 0,55.', { liquidez: 1.8, endeudamiento: 0.55 }],
  ['EP-04', 'Veces', 'El proponente deberá acreditar un índice de liquidez mínimo de 1,3 veces', { liquidez: 1.3 }],
  ['EP-05', 'Años de corte intercalados', 'Índice de liquidez con corte a 31 de diciembre de 2025 mayor o igual a 1,4', { liquidez: 1.4 }],
  ['EP-06', 'Valor ANTES de la etiqueta (orden invertido)', 'Mayor o igual a 1,5 en el índice de liquidez', { liquidez: undefined }],
  ['EP-07', 'Texto "análisis del sector" con promedios del sector antes del requisito', 'ANÁLISIS DEL SECTOR. Según la Superintendencia de Sociedades, el índice de liquidez promedio del sector construcción fue 2,35 y el índice de endeudamiento promedio fue 0,52. REQUISITOS HABILITANTES. Índice de liquidez mayor o igual a 1,2. Índice de endeudamiento menor o igual a 0,70.', { liquidez: 1.2, endeudamiento: 0.7 }],
  ['EP-08', 'Dos lotes con umbrales distintos para el mismo indicador', 'Lote 1: índice de liquidez mayor o igual a 1,2. Lote 2: índice de liquidez mayor o igual a 2,0.', { liquidez: null }],
  ['EP-09', 'Estudio previo cita un valor "de referencia" no vinculante', 'Para este proceso se tomará como referencia un índice de liquidez de 1,0, sin perjuicio de lo que defina el pliego de condiciones definitivo en el índice de liquidez mayor o igual a 1,6.', { liquidez: null }],
  ['EP-10', 'Endeudamiento en porcentaje', 'Nivel de endeudamiento menor o igual al 70%', { endeudamiento: 0.7 }],
  ['EP-12', 'Cobertura "no aplica"', 'La razón de cobertura de intereses no será exigida cuando el proponente no tenga gastos de intereses', { cobertura: null }],
  ['EP-13', 'Liquidez mencionada con una cifra de otro concepto (garantía)', 'El índice de liquidez será verificado en el RUP. La garantía de seriedad será del 10% del presupuesto oficial.', { liquidez: null }],
  ['EP-14', 'Solo hay referencia normativa', 'Los indicadores de liquidez y endeudamiento se verificarán conforme al Decreto 1082 de 2015 y el Manual de Colombia Compra Eficiente (M-DVRHPC-05).', { liquidez: null, endeudamiento: null }]
];
casos.forEach(([id, titulo, texto, esperado]) => {
  sonda(id, 'Umbrales: ' + titulo, () => {
    const malos = [], nd = [], bien = [];
    Object.keys(esperado).forEach(k => {
      const got = umbralDe(texto, k);
      const val = got ? got.valor : undefined;
      const exp = esperado[k];
      if (exp === null || exp === undefined) { (val != null ? malos : nd).push(k + '=' + J(val)); }
      else if (val == null) nd.push(k);
      else if (Math.abs(val - exp) > 1e-9 && !(got.pct && Math.abs(val / 100 - exp) < 1e-9)) malos.push(k + '=' + J(val) + ' (esperado ' + exp + ')');
      else bien.push(k + '=' + val);
    });
    return { v: malos.length ? 'HALLAZGO' : 'OK', ev: 'correctos=[' + bien + '] sin dato (ND)=[' + nd + '] ERRÓNEOS=[' + malos + ']' };
  });
});

sonda('EP-11', 'Endeudamiento "menor o igual a 70" (sin %): la extracción lee 70 pero el GATE debe quedar NO DETERMINABLE', () => {
  const u = exig('Índice de endeudamiento menor o igual a 70').endeudamiento;
  const g = expEngine.compararIndiceConUmbral('Índice de endeudamiento', u, 0.45, '<=', true);
  return { v: g.estado === 'nd' ? 'OK' : 'HALLAZGO', ev: 'umbral=' + J({ valor: u.valor, pct: u.porcentaje }) + ' -> gate=' + J(g) };
});

sonda('EP-15', 'Ausencia de aviso cuando un indicador aparece con DOS valores distintos en el documento (regex)', () => {
  const t = 'Primero: índice de liquidez mayor o igual a 1,2. Más adelante: índice de liquidez mayor o igual a 2,0.';
  const u = umbralDe(t, 'liquidez');
  return { v: u && u.valor != null ? 'HALLAZGO' : 'OK', ev: 'umbral elegido=' + J(u) + ' (el documento trae 1,2 y 2,0; IA-004 detecta el conflicto solo en filas de IA, no en el camino por texto)' };
});

sonda('EP-16', 'Capital de trabajo, patrimonio y rentabilidad: ¿el camino por texto los extrae (para poder compararlos)?', () => {
  const claves = Object.keys(exig('Capital de trabajo mayor o igual a $500.000.000. Patrimonio mayor o igual al 50% del presupuesto. Rentabilidad del patrimonio mayor o igual a 0,05.'));
  return { v: claves.some(k => /patrimonio|capital/i.test(k)) ? 'OK' : 'HALLAZGO', ev: 'claves que devuelve extraerExigencias=' + J(claves) + ' -> sin IA, patrimonio / capital de trabajo / rentabilidad no se extraen ni generan gate.' };
});

// =====================================================================================
// D. K residual
// =====================================================================================
[
  ['KR-01', 'Monto explícito', 'La capacidad residual del proponente deberá ser igual o superior a $3.449.518.408', { valor: 3449518408 }],
  ['KR-02', 'Solo referencia normativa', 'La capacidad residual se calculará conforme al Decreto 1082 de 2015.', { valor: null }],
  ['KR-03', 'Relativa al presupuesto', 'La capacidad residual deberá ser mayor o igual al 100% del presupuesto oficial', { valor: null, relativo: true }],
  ['KR-04', 'Cita del estudio del sector (no es requisito)', 'En el estudio del sector se encontró que la capacidad residual promedio de los oferentes fue de $12.000.000.000.', { valor: null }],
  ['KR-05', 'Dos montos distintos en el mismo documento', 'La capacidad residual será de $3.000.000.000. Anexo: capacidad residual de $5.000.000.000.', { valor: null }]
].forEach(([id, titulo, texto, esp]) => sonda(id, 'K residual: ' + titulo, () => {
  const k = exig(texto).kResidual;
  const val = k ? k.valor : null;
  const malo = esp.valor == null ? val != null : val !== esp.valor;
  return { v: malo ? 'HALLAZGO' : 'OK', ev: 'kResidual=' + J(k && { valor: k.valor, unidad: k.unidad, relativo: k.relativo, conflicto: k.conflicto, motivo: k.motivo }) };
}));

// =====================================================================================
// E. Veredicto: ¿puede salir GO sin sustento suficiente?
// =====================================================================================
const CTX = { minV: 0, maxV: 0, perfilesProfesionales: {}, perfiles: [] };
const item = (e) => Object.assign({ id: 'p1', entidad: 'Municipio X', valor: 500000000, estado: 'Abierta' }, e || {});
const matriz = (e) => Object.assign({ id: 'perf1', nombre: 'Mi empresa', codigos: ['72141003'], kResidual: { unidad: 'COP', valor: 600000000 }, capacidadEstimada: null, liquidez: 1.5, endeudamiento: 0.4, cobertura: null, patrimonio: null, capitalTrabajo: null }, e || {});
const entry = (e) => Object.assign({ id: 'p1', exigencias: { liquidez: { valor: 1.2, porcentaje: false }, endeudamiento: { valor: 0.6, porcentaje: false } },
  experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, resultados: [{ id: 1 }], totalObligatorios: 1 } }, e || {});

sonda('VER-01', 'Solo hay ESTUDIO PREVIO (no hay Pliego de Condiciones) y todo lo extraído está en verde: ¿el resultado puede ser GO?', () => {
  const r = expEngine.evaluarProceso(item(), { daysLeft: 20 }, matriz(), entry({ esSoloEP: true }), CTX);
  return { v: r.veredictoGlobal === 'GO' ? 'HALLAZGO' : 'OK', ev: 'veredictoGlobal=' + r.veredictoGlobal + ' conPliego=' + r.conPliego + ' | gates=' + J(r.gates.map(g => g.nombre + ':' + g.estado)) + ' -> el Estudio Previo no es el documento vinculante; los requisitos del pliego definitivo pueden cambiar.' };
});

sonda('VER-02', 'Pliego por texto exige capital de trabajo, patrimonio, rentabilidad y garantías, pero solo se extrajo liquidez/endeudamiento: ¿GO?', () => {
  const e = entry({ comps: [{ perfilNombre: 'Tu perfil', hallazgosAnotados: [
    { categoria: 'Capacidad Organizacional', snippet: 'Rentabilidad del patrimonio mayor o igual a 0,15 y rentabilidad del activo mayor o igual a 0,08' },
    { categoria: 'Capacidad financiera', snippet: 'Capital de trabajo mayor o igual al 40% del presupuesto oficial; patrimonio mayor o igual a $9.000.000.000' },
    { categoria: 'Garantías', snippet: 'Garantía de seriedad por el 10% del presupuesto oficial' }] }] });
  const r = expEngine.evaluarProceso(item(), { daysLeft: 20 }, matriz(), e, CTX);
  const texto = expEngine.descripcionVeredicto ? expEngine.descripcionVeredicto(r.veredictoGlobal) : '';
  return { v: r.veredictoGlobal === 'GO' ? 'HALLAZGO' : 'OK', ev: 'veredictoGlobal=' + r.veredictoGlobal + ' | gates=' + J(r.gates.map(g => g.nombre + ':' + g.estado)) + ' | texto del resultado="' + texto + '" -> los requisitos organizacional/financiero adicionales detectados como hallazgo NO bloquean el GO.' };
});

sonda('VER-03', 'Pliego por texto: la frase de CÓDIGOS UNSPSC es de EXPERIENCIA (contratos), no de inscripción: ¿NO-GO por clasificación?', () => {
  const e = entry({ comps: [{ perfilNombre: 'Tu perfil', hallazgosAnotados: [
    { categoria: 'RUP / Clasificador', snippet: 'La experiencia deberá acreditarse con contratos cuyo objeto corresponda a los códigos UNSPSC 72141003, 72141004 y 95121701 del clasificador' }] }] });
  const r = expEngine.evaluarProceso(item(), { daysLeft: 20 }, matriz({ codigos: ['43211500'] }), e, CTX);
  const g = r.gates.find(x => x.nombre === 'Clasificación UNSPSC');
  return { v: g && g.estado === 'fail' ? 'HALLAZGO' : 'OK', ev: 'gate UNSPSC=' + J(g) + ' veredicto=' + r.veredicto + ' -> un NO-GO por una frase que describe los contratos de experiencia, no la inscripción del proponente.' };
});

sonda('VER-04', 'Sin K residual exigida en el documento y capacidad del perfil insuficiente: gate "Capacidad vs valor" no bloquea el GO con certeza', () => {
  const r = expEngine.evaluarProceso(item({ valor: 5000000000 }), { daysLeft: 20 }, matriz(), entry(), CTX);
  const g = r.gates.find(x => x.nombre === 'Capacidad vs valor');
  return { v: g && g.estado === 'revisar' && r.veredicto !== 'GO' ? 'OK' : 'HALLAZGO', ev: 'gate=' + J(g) + ' veredicto=' + r.veredicto };
});

sonda('VER-05', 'Comparación SMMLV↔pesos: un contrato de $1.200M vs requisito "15.000 SMMLV" sin regla de año explícita', () => {
  const v = expEngine.valorContratoEnSmmlv({ valor: 1200000000, fechaFin: '2024-06-30', fechaInicio: '2023-01-10' }, null);
  const v2 = expEngine.valorContratoEnSmmlv({ valor: 1200000000, fechaFin: '2024-06-30' }, 'fecha_terminacion');
  return { v: v === null ? 'OK' : 'HALLAZGO', ev: 'sin regla=' + J(v) + ' | con regla de terminación (2024: 1.300.000)=' + J(v2) };
});

sonda('VER-06', 'Gate de experiencia: ¿el resultado depende solo del conteo del motor (no de texto libre)?', () => {
  const g = expEngine.experienciaGateDetalle({ experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 2, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, resultados: [{}, {}], totalObligatorios: 2 } });
  return { v: g.estado === 'ok' ? 'OK' : 'HALLAZGO', ev: J(g) };
});

// =====================================================================================
// F. Categorizador de hallazgos (analizarTexto) -- alimenta el gate UNSPSC
// =====================================================================================
const cuerpo = extractMainScript();
const iC = cuerpo.indexOf('const REQUISITO_CATEGORIAS = [');
const iCFin = cuerpo.indexOf('\n  ];', iC) + 5;
const iA = cuerpo.indexOf('function analizarTexto(text){');
const iAFin = cuerpo.indexOf('// Ya NO compara experiencia', iA);
const analizarTexto = new Function('truncate', 'extraerKResidual', 'extraerExigencias', cuerpo.slice(iC, iCFin) + '\n' + cuerpo.slice(iA, iAFin) + '\nreturn analizarTexto;')(globalThis.truncate, () => null, expEngine.extraerExigencias);

sonda('CAT-01', 'La palabra "corrupción" ¿se clasifica como hallazgo "RUP / Clasificador" (el disparador "rup" es una subcadena)?', () => {
  const h = analizarTexto('El oferente declara que no ha incurrido en actos de corrupción ni en conductas contrarias al Estatuto Anticorrupción.').hallazgos;
  const rup = h.filter(x => x.categoria === 'RUP / Clasificador');
  return { v: rup.length ? 'HALLAZGO' : 'OK', ev: 'hallazgos RUP/Clasificador=' + J(rup) };
});

sonda('CAT-02', 'Una frase de corrupción ANTES del requisito RUP real: ¿el requisito real (con sus códigos UNSPSC) se pierde?', () => {
  const t = 'El oferente declara que no ha incurrido en actos de corrupción durante el proceso. El proponente deberá estar inscrito en el RUP en las clasificaciones UNSPSC 72141003 y 72141004.';
  const rup = analizarTexto(t).hallazgos.filter(x => x.categoria === 'RUP / Clasificador');
  const conCodigos = rup.some(x => /72141003/.test(x.snippet));
  return { v: conCodigos ? 'OK' : 'HALLAZGO', ev: 'snippets RUP=' + J(rup.map(x => x.snippet)) + ' -> el requisito real ' + (conCodigos ? 'sí' : 'NO') + ' quedó registrado' };
});

sonda('CAT-03', 'Un número de 8 dígitos (código de proceso) en la misma frase que "corrupción": ¿se convierte en código UNSPSC exigido y da NO-GO?', () => {
  const t = 'Declaración de no incurrir en actos de corrupción dentro del proceso CO1.NTC.10975958 de la entidad.';
  const h = analizarTexto(t).hallazgos;
  const e = { id: 'p1', exigencias: { liquidez: { valor: 1.2, porcentaje: false }, endeudamiento: { valor: 0.6, porcentaje: false } },
    experienciaResultado: { resultadoGlobal: 'CUMPLE', conteo: { 'CUMPLE': 1, 'NO CUMPLE': 0, 'NO DETERMINABLE': 0 }, resultados: [{ id: 1 }], totalObligatorios: 1 },
    comps: [{ perfilNombre: 'Tu perfil', hallazgosAnotados: h }] };
  const r = expEngine.evaluarProceso(item(), { daysLeft: 20 }, matriz({ codigos: ['72141003'] }), e, CTX);
  const g = r.gates.find(x => x.nombre === 'Clasificación UNSPSC');
  return { v: g && g.estado === 'fail' ? 'HALLAZGO' : 'OK', ev: 'gate UNSPSC=' + J(g) + ' | veredicto=' + r.veredicto };
});

// =====================================================================================
// G. Anti-alucinación de la extracción con IA: ¿qué NO ata la verificación a la fuente?
// =====================================================================================
const PAG = 'Capacidad financiera. El proponente deberá acreditar: Índice de liquidez mayor o igual a 1,2 Índice de endeudamiento menor o igual a 0,70 Razón de cobertura de intereses mayor o igual a 1,0. ';
const OFF = [{ pagina: 1, hasta: PAG.length }];
const filaInd = (extra) => Object.assign({ categoria: 'capacidad_financiera', descripcion: 'Indicador', obligatoriedad: 'obligatorio', naturaleza: 'habilitante', documento: 'Pliego de Condiciones', pagina: 1,
  cita_textual: 'Índice de liquidez mayor o igual a 1,2 Índice de endeudamiento menor o igual a 0,70', confianza: 'alta', modificado_por_adenda: false, indicador: 'liquidez', operador: '>=', valor_indicador: 1.2, unidad_indicador: null,
  min_contratos: null, valor_minimo_numero: null, valor_minimo_unidad: null, valor_minimo_pct_presupuesto: null, cantidad_minima_numero: null, cantidad_minima_unidad: null, ventana_anios: null, objeto_literal: null, codigos_unspsc: [] }, extra || {});
const verif = f => Object.assign({}, f, { verificada: expEngine.verificarFilaIA(f, PAG, OFF).verificada });

sonda('IA-01', 'Fila IA correcta (liquidez 1,2) -> verificada y umbral 1,2', () => {
  const f = verif(filaInd());
  const ex = expEngine.exigenciasDesdeIA([f]);
  return { v: f.verificada === true && ex.liquidez && ex.liquidez.valor === 1.2 ? 'OK' : 'HALLAZGO', ev: 'verificada=' + f.verificada + ' exigencia=' + J(ex.liquidez) };
});
sonda('IA-02', 'Cita inventada (no existe en el PDF) -> no se verifica y no produce umbral', () => {
  const f = verif(filaInd({ cita_textual: 'El índice de liquidez deberá ser mayor o igual a 1,2 conforme al anexo técnico del proceso' }));
  const ex = expEngine.exigenciasDesdeIA([f]);
  return { v: f.verificada === false && !(ex.liquidez && ex.liquidez.valor != null) ? 'OK' : 'HALLAZGO', ev: 'verificada=' + f.verificada + ' exigencia=' + J(ex.liquidez) };
});
sonda('IA-03', 'INDICADOR CRUZADO: la IA etiqueta como "liquidez" la cifra 0,70 (que en la cita pertenece a endeudamiento) con una cita real y exacta', () => {
  const f = verif(filaInd({ indicador: 'liquidez', operador: '>=', valor_indicador: 0.7 }));
  const ex = expEngine.exigenciasDesdeIA([f]);
  return { v: ex.liquidez && ex.liquidez.valor === 0.7 ? 'HALLAZGO' : 'OK', ev: 'verificada=' + f.verificada + ' bloqueo=' + J(expEngine.motivoBloqueoFilaIA(f)) + ' exigencia liquidez=' + J(ex.liquidez && { valor: ex.liquidez.valor }) + ' (la cita real exige 1,2; el motor usaría 0,7 y daría CUMPLE con liquidez 1,0)' };
});
sonda('IA-04', 'INDICADOR CRUZADO: la IA etiqueta como "endeudamiento" la cifra 1,2 (que en la cita pertenece a liquidez), operador "<="', () => {
  const f = verif(filaInd({ indicador: 'endeudamiento', operador: '<=', valor_indicador: 1.2 }));
  const ex = expEngine.exigenciasDesdeIA([f]);
  return { v: ex.endeudamiento && ex.endeudamiento.valor === 1.2 ? 'HALLAZGO' : 'OK', ev: 'verificada=' + f.verificada + ' exigencia endeudamiento=' + J(ex.endeudamiento && { valor: ex.endeudamiento.valor }) };
});
sonda('IA-05', 'La verificación de una fila financiera NO exige que el nombre del indicador aparezca en la cita', () => {
  const f = verif(filaInd({ cita_textual: 'mayor o igual a 1,2', indicador: 'cobertura_intereses', operador: '>=', valor_indicador: 1.2 }));
  return { v: f.verificada === true ? 'HALLAZGO' : 'OK', ev: 'verificada=' + f.verificada + ' (una cita sin nombrar el indicador respalda cualquier indicador que la IA elija)' };
});

// =====================================================================================
// H. Generación documental
// =====================================================================================
sonda('DOC-01', 'Carta de presentación con perfil vacío: ¿todo dato faltante queda como [PLACEHOLDER] y no se inventa nada?', () => {
  const t = expEngine.generarCartaTexto({}, { entidad: 'Municipio X', objeto: 'Construcción de puente', modalidad: 'Licitación pública', referencia: 'LP-008-2026' }, true);
  const faltantes = ['[REPRESENTANTE LEGAL]', '[CÉDULA DEL REPRESENTANTE LEGAL]', '[RAZÓN SOCIAL]', '[NIT]', '[DIRECCIÓN]', '[TELÉFONO]', '[CORREO ELECTRÓNICO]', '[COMPLETAR: valor de la oferta]', '[COMPLETAR: plazo ofrecido]'];
  const sin = faltantes.filter(x => t.indexOf(x) === -1);
  return { v: sin.length ? 'HALLAZGO' : 'OK', ev: 'placeholders ausentes=' + J(sin) };
});
sonda('DOC-02', 'Carta para PERSONA NATURAL (sin razón social): ¿dice "sociedad" / "representante legal" aunque no aplique?', () => {
  const t = expEngine.generarCartaTexto({ nombre: 'JUAN PEREZ GOMEZ', nit: '12345678-9', representanteLegal: 'JUAN PEREZ GOMEZ' }, { entidad: 'Municipio X', objeto: 'Obra', modalidad: 'Licitación pública', referencia: 'LP-1' }, true);
  return { v: /sociedad identificada con NIT/.test(t) ? 'HALLAZGO' : 'OK', ev: 'fragmento="' + (t.match(/obrando en calidad[^,]*,[^,]*,/) || [''])[0] + '"' };
});

console.log('\nRESUMEN: ' + ['OK', 'HALLAZGO', 'INFO'].map(k => k + '=' + resultados.filter(r => r.v === k).length).join('  '));
console.log('HALLAZGOS: ' + resultados.filter(r => r.v === 'HALLAZGO').map(r => r.id).join(', '));
