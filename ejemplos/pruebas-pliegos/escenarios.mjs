// Escenarios FICTICIOS para probar el análisis de pliegos (CUMPLE / NO CUMPLE / NO DETERMINABLE).
//
// Una sola fuente de verdad: de aquí salen los archivos que carga el usuario (generar.mjs) y las pruebas
// de tests/smoke.mjs que verifican qué resultado da el motor real con cada empresa. Todo es inventado: ninguna
// empresa, NIT, contrato ni entidad existe.
//
// Las fechas son relativas a `hoyISO` (por defecto, hoy) porque el motor usa la fecha real: un contrato de
// «hace 2 años» tiene que seguir dentro de la ventana de 10 años y uno de «hace 15 años» fuera de ella.

const DIA = 86400000;

function sumarDias(iso, dias) {
  return new Date(Date.parse(iso + 'T00:00:00Z') + dias * DIA).toISOString().slice(0, 10);
}
const haceAnios = (hoy, a) => sumarDias(hoy, -Math.round(a * 365));

// Encabezados que reconoce el importador de Excel de experiencia (DICC_CONTRATO en index.html).
export const ENCABEZADOS_EXPERIENCIA = [
  'Número de contrato', 'Objeto del contrato', 'Entidad contratante', 'Valor del contrato',
  'Fecha de inicio', 'Fecha de terminación', 'Porcentaje de participación'
];

// Un contrato = una fila del Excel de experiencia.
function contrato(numero, objeto, contratante, valor, ini, fin, participacion) {
  return [numero, objeto, contratante, valor, ini, fin, participacion == null ? '' : participacion];
}

const OBJ_VIAS_A = 'Construcción de pavimento en vías urbanas del municipio ficticio de Villa Norte';
const OBJ_VIAS_B = 'Mejoramiento y construcción de vías urbanas en concreto asfáltico, municipio ficticio de Monte Sur';
const OBJ_VIAS_C = 'Construcción de vías urbanas y andenes en el barrio ficticio El Mirador';
const OBJ_PUENTE = 'Construcción de puentes vehiculares sobre la quebrada ficticia La Brava';

const FIRMA = { representanteLegal: 'Persona Ficticia', representanteCedula: '1.000.000.000', telefono: '3000000000', direccion: 'Calle Ficticia 1 # 2-3', ciudad: 'Cúcuta', correo: 'ficticia@example.com', objeto_social: 'Construcción de obras civiles (empresa ficticia para pruebas)' };

export function construir(hoyISO) {
  const hoy = hoyISO || new Date().toISOString().slice(0, 10);
  const fin = a => haceAnios(hoy, a);
  const ini = a => haceAnios(hoy, a + 1);
  const futuro = d => sumarDias(hoy, d);

  // ---- Empresas -----------------------------------------------------------------------------------------
  // `k` es texto libre: una línea por dato, como lo llena el RUP. `kResidual` va aparte.
  const empresas = [
    {
      id: 'ficticia-01-andina', etiqueta: 'Andina',
      queProbamos: 'Cumple todo lo del Pliego 1',
      perfil: Object.assign({ nombre: 'FICTICIA 01 · Constructora Andina S.A.S.', nit: '900.000.001-1', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 2,0\nÍndice de endeudamiento: 0,40\nRazón de cobertura de intereses: 8,5\nPatrimonio: $4.200.000.000\nCapital de trabajo: $2.100.000.000',
        kResidual: 'K residual = $8.000.000.000', rup: '72141000, 72141100, 72101500' }, FIRMA),
      contratos: [
        contrato('A-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2400000000, ini(2.5), fin(2.5)),
        contrato('A-002', OBJ_VIAS_B, 'Municipio ficticio de Monte Sur', 3100000000, ini(3), fin(3)),
        contrato('A-003', OBJ_PUENTE, 'Departamento ficticio de Tierra Alta', 1500000000, ini(3), fin(3))
      ]
    },
    {
      id: 'ficticia-02-frontera', etiqueta: 'Frontera',
      queProbamos: 'Falla los indicadores financieros (liquidez y endeudamiento)',
      perfil: Object.assign({ nombre: 'FICTICIA 02 · Obras Frontera Ltda.', nit: '900.000.002-2', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 1,0\nÍndice de endeudamiento: 0,75\nRazón de cobertura de intereses: 1,2\nPatrimonio: $900.000.000\nCapital de trabajo: $150.000.000',
        kResidual: 'K residual = $8.000.000.000', rup: '72141000, 72141100' }, FIRMA),
      contratos: [
        contrato('F-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2000000000, ini(2), fin(2)),
        contrato('F-002', OBJ_VIAS_B, 'Municipio ficticio de Monte Sur', 2200000000, ini(3), fin(3)),
        contrato('F-003', OBJ_PUENTE, 'Departamento ficticio de Tierra Alta', 600000000, ini(3), fin(3))
      ]
    },
    {
      id: 'ficticia-03-catatumbo', etiqueta: 'Catatumbo',
      queProbamos: 'Finanzas bien, pero no llega al mínimo de 2 contratos en la ventana de 10 años',
      perfil: Object.assign({ nombre: 'FICTICIA 03 · Ingeniería Catatumbo S.A.S.', nit: '900.000.003-3', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 2,2\nÍndice de endeudamiento: 0,35\nRazón de cobertura de intereses: 9\nPatrimonio: $5.000.000.000\nCapital de trabajo: $2.500.000.000',
        kResidual: 'K residual = $9.000.000.000', rup: '72141000, 72141100' }, FIRMA),
      contratos: [
        contrato('C-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2600000000, ini(2), fin(2)),
        // Hace 15 años: fuera de la ventana de 10 años del pliego, no acredita.
        contrato('C-002', OBJ_VIAS_C, 'Municipio ficticio de Monte Sur', 2900000000, ini(15), fin(15)),
        contrato('C-003', OBJ_PUENTE, 'Departamento ficticio de Tierra Alta', 1800000000, ini(15), fin(15))
      ]
    },
    {
      id: 'ficticia-04-pamplona', etiqueta: 'Pamplona',
      queProbamos: 'K residual declarada alcanza, pero los contratos en ejecución la dejan corta',
      perfil: Object.assign({ nombre: 'FICTICIA 04 · Consorcio Vial Pamplona S.A.S.', nit: '900.000.004-4', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 1,9\nÍndice de endeudamiento: 0,45\nRazón de cobertura de intereses: 6\nPatrimonio: $3.800.000.000\nCapital de trabajo: $1.900.000.000',
        kResidual: 'K residual = $6.000.000.000', rup: '72141000, 72141100',
        capacidadActualizada: sumarDias(hoy, -30),
        contratosEnEjecucion: [
          { id: 'ce-ficticio-1', nombre: 'Obra ficticia 1', numero: 'EJ-001', entidad: 'Entidad ficticia A', tipoCliente: 'publico', estado: 'en_ejecucion', valorInicial: '3.000.000.000', valorActual: '3.000.000.000', valorEjecutado: '500.000.000', saldo: '2.500.000.000', fechaInicio: sumarDias(hoy, -120), fechaFin: futuro(150), consorcio: false, participacion: '', soporte: '' },
          { id: 'ce-ficticio-2', nombre: 'Obra ficticia 2', numero: 'EJ-002', entidad: 'Entidad ficticia B', tipoCliente: 'publico', estado: 'en_ejecucion', valorInicial: '2.400.000.000', valorActual: '2.400.000.000', valorEjecutado: '400.000.000', saldo: '2.000.000.000', fechaInicio: sumarDias(hoy, -90), fechaFin: futuro(200), consorcio: false, participacion: '', soporte: '' }
        ] }, FIRMA),
      contratos: [
        contrato('P-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2300000000, ini(2), fin(2)),
        contrato('P-002', OBJ_VIAS_B, 'Municipio ficticio de Monte Sur', 2700000000, ini(4), fin(4))
      ]
    },
    {
      id: 'ficticia-05-sardinata', etiqueta: 'Sardinata',
      queProbamos: 'Todo bien, pero su RUP está clasificado en otra actividad',
      perfil: Object.assign({ nombre: 'FICTICIA 05 · Servicios Sardinata Ltda.', nit: '900.000.005-5', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 2,1\nÍndice de endeudamiento: 0,38\nRazón de cobertura de intereses: 7\nPatrimonio: $4.000.000.000\nCapital de trabajo: $2.000.000.000',
        kResidual: 'K residual = $7.500.000.000', rup: '81101500, 81101700' }, FIRMA),
      contratos: [
        contrato('S-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2100000000, ini(2), fin(2)),
        contrato('S-002', OBJ_VIAS_B, 'Municipio ficticio de Monte Sur', 2500000000, ini(3), fin(3))
      ]
    },
    {
      id: 'ficticia-06-tibu', etiqueta: 'Tibú',
      queProbamos: 'Datos dudosos o ambiguos: nunca debe salir CUMPLE inventado',
      perfil: Object.assign({ nombre: 'FICTICIA 06 · Obras Tibú S.A.S.', nit: '900.000.006-6', tipoPersona: 'juridica',
        // Endeudamiento «45» sin % (¿razón o porcentaje?), cobertura «INDETERMINADO», K residual en SMMLV.
        k: 'Índice de liquidez: 1,8\nÍndice de endeudamiento: 45\nRazón de cobertura de intereses: INDETERMINADO\nPatrimonio: $2.000.000.000',
        kResidual: 'K residual = 4.000 SMMLV', rup: '72141000' }, FIRMA),
      contratos: [
        // Sin fecha de terminación confiable (texto ambiguo «12/2/94»).
        contrato('T-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2200000000, '', '12/2/94'),
        contrato('T-002', OBJ_VIAS_B, 'Municipio ficticio de Monte Sur', 2400000000, ini(2), fin(2)),
        contrato('T-003', OBJ_PUENTE, 'Departamento ficticio de Tierra Alta', 1600000000, '', '')
      ]
    },
    {
      id: 'ficticia-07-ocana', etiqueta: 'Ocaña',
      queProbamos: 'Sola no alcanza 2 contratos; junto con Ábrego (consorcio) sí',
      perfil: Object.assign({ nombre: 'FICTICIA 07 · Constructora Ocaña S.A.S. (integrante de consorcio)', nit: '900.000.007-7', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 1,7\nÍndice de endeudamiento: 0,50\nRazón de cobertura de intereses: 5\nPatrimonio: $3.000.000.000\nCapital de trabajo: $1.500.000.000',
        kResidual: 'K residual = $6.000.000.000', rup: '72141000, 72141100' }, FIRMA),
      contratos: [
        contrato('O-001', OBJ_VIAS_A, 'Municipio ficticio de Villa Norte', 2500000000, ini(2), fin(2), 100),
        // Puente en unión temporal: Ocaña participó con el 30 %.
        contrato('O-002', OBJ_PUENTE, 'Departamento ficticio de Tierra Alta', 3000000000, ini(3), fin(3), 30)
      ]
    },
    {
      id: 'ficticia-08-abrego', etiqueta: 'Ábrego',
      queProbamos: 'Segundo integrante del consorcio con Ocaña',
      perfil: Object.assign({ nombre: 'FICTICIA 08 · Ingenieros Ábrego Ltda. (integrante de consorcio)', nit: '900.000.008-8', tipoPersona: 'juridica',
        k: 'Índice de liquidez: 1,6\nÍndice de endeudamiento: 0,55\nRazón de cobertura de intereses: 4\nPatrimonio: $2.800.000.000\nCapital de trabajo: $1.400.000.000',
        kResidual: 'K residual = $6.000.000.000', rup: '72141000, 72141100' }, FIRMA),
      contratos: [
        contrato('B-001', OBJ_VIAS_B, 'Municipio ficticio de Monte Sur', 2800000000, ini(3), fin(3), 100)
      ]
    },
    {
      id: 'ficticia-09-nueva', etiqueta: 'Nueva',
      queProbamos: 'Empresa recién creada sin datos: todo debe quedar NO DETERMINABLE',
      perfil: Object.assign({ nombre: 'FICTICIA 09 · Empresa Recién Creada S.A.S.', nit: '900.000.009-9', tipoPersona: 'juridica',
        k: '', kResidual: '', rup: '' }, FIRMA),
      contratos: []
    }
  ];

  // ---- Profesionales (el módulo Personal es global, no por empresa) -------------------------------------
  const profesionales = {
    'prof-ficticio-1': { nombre: 'Carlos Ruiz (ficticio)', cargo: 'Director de obra', formacion: 'Ingeniero civil', anos: '12', especializaciones: 'Gerencia de proyectos', experiencia: 'Dirección de obras de pavimentación y puentes', competencias: '' },
    'prof-ficticio-2': { nombre: 'Marta Gómez (ficticia)', cargo: 'Residente de obra', formacion: 'Ingeniera civil', anos: '8', especializaciones: '', experiencia: 'Residencia de obras viales', competencias: '' },
    'prof-ficticio-3': { nombre: 'Luis Prada (ficticio)', cargo: 'Ingeniero ambiental', formacion: 'Ingeniero ambiental', anos: '6', especializaciones: '', experiencia: 'Plan de manejo ambiental', competencias: '' },
    'prof-ficticio-4': { nombre: 'Ana Torres (ficticia)', cargo: 'Especialista en pavimentos', formacion: 'Ingeniera civil', anos: '10', especializaciones: 'Pavimentos', experiencia: 'Diseño y control de pavimentos', competencias: '' }
  };

  // ---- Procesos ficticios (Mis procesos): dan el valor y el cierre contra los que se compara -------------
  const cierre = new Date(Date.parse(futuro(180) + 'T17:00:00Z')).toISOString();
  const publicado = new Date(Date.parse(sumarDias(hoy, -10) + 'T12:00:00Z')).toISOString();
  const procesos = [
    { id: 'ficticio-pliego-1', pliego: 1, valor: 5000000000, objeto: 'PRUEBA 1 · Pavimentación de vías urbanas del municipio ficticio de Villa Prueba', entidad: 'MUNICIPIO FICTICIO DE VILLA PRUEBA', referencia: 'LP-FICT-001' },
    { id: 'ficticio-pliego-2', pliego: 2, valor: 4000000000, objeto: 'PRUEBA 2 · Construcción de puente vehicular en el municipio ficticio de Tierra Alta', entidad: 'DEPARTAMENTO FICTICIO DE TIERRA ALTA', referencia: 'LP-FICT-002' },
    { id: 'ficticio-pliego-3', pliego: 3, valor: 3000000000, objeto: 'PRUEBA 3 · Obra civil con requisitos sin cifras (municipio ficticio de Roca Seca)', entidad: 'MUNICIPIO FICTICIO DE ROCA SECA', referencia: 'LP-FICT-003' }
  ].map(p => Object.assign(p, { modalidad: 'Licitación pública', fuente: 'II', departamento: 'Norte de Santander', ciudad: 'Cúcuta', closingRaw: cierre, pubRaw: publicado, url: 'https://example.com/proceso-ficticio' }));

  // ---- Pliegos (una cadena por página, como los entrega el lector de PDF) -------------------------------
  const RELLENO = ' Las propuestas se presentarán en la sede de la entidad en sobre cerrado, dentro del plazo del cronograma. Los plazos, la forma de pago y las demás condiciones contractuales se rigen por este documento y por las adendas que se publiquen en la plataforma. Documento ficticio elaborado solo para pruebas de la aplicación.';
  const pliegos = [
    {
      id: 1, archivo: 'pliego-1-vias-urbanas.pdf', titulo: 'PLIEGO 1 · Pavimentación de vías urbanas (FICTICIO)',
      paginas: [
        'PLIEGO DE CONDICIONES FICTICIO LP-FICT-001. LICITACIÓN PÚBLICA. Objeto: pavimentación de vías urbanas del municipio ficticio de Villa Prueba. Presupuesto oficial: $5.000.000.000.' + RELLENO,
        'Requisitos habilitantes de capacidad financiera. Índice de liquidez mayor o igual a 1,5. Índice de endeudamiento menor o igual a 0,60. Razón de cobertura de intereses mayor o igual a 2,0.' + RELLENO,
        'La capacidad residual mínima exigida es de $5.000.000.000. El proponente deberá estar inscrito en el RUP con la clasificación UNSPSC 72 14 10 00.' + RELLENO,
        'El personal requerido para la ejecución incluye un director de obra, ingeniero civil, con dedicación del 50 %.' + RELLENO,
        'Requisitos de experiencia: 1. Experiencia específica del proponente: mínimo 2 contratos de construcción de vías urbanas, dentro de los últimos diez (10) años.'
      ]
    },
    {
      id: 2, archivo: 'pliego-2-puente-smmlv.pdf', titulo: 'PLIEGO 2 · Puente vehicular con experiencia en SMMLV (FICTICIO)',
      paginas: [
        'PLIEGO DE CONDICIONES FICTICIO LP-FICT-002. LICITACIÓN PÚBLICA. Objeto: construcción de un puente vehicular en el municipio ficticio de Tierra Alta. Presupuesto oficial: $4.000.000.000.' + RELLENO,
        'Requisitos habilitantes de capacidad financiera. Índice de liquidez mayor o igual a 1,2. Índice de endeudamiento menor o igual a 0,70.' + RELLENO,
        'Regla de conversión: cuando un valor de este pliego se exprese en SMMLV, se convertirá con el salario mínimo mensual legal vigente del año correspondiente a la fecha de terminación del contrato.' + RELLENO,
        'Requisitos de experiencia: 1. Experiencia específica del proponente: mínimo 1 contrato de construcción de puentes vehiculares por valor igual o superior a 900 SMMLV, dentro de los últimos diez (10) años.'
      ]
    },
    {
      id: 3, archivo: 'pliego-3-sin-cifras.pdf', titulo: 'PLIEGO 3 · Requisitos sin cifras (FICTICIO)',
      paginas: [
        'PLIEGO DE CONDICIONES FICTICIO LP-FICT-003. LICITACIÓN PÚBLICA. Objeto: obra civil en el municipio ficticio de Roca Seca. Presupuesto oficial: $3.000.000.000.' + RELLENO,
        'El proponente deberá demostrar una capacidad financiera suficiente y una trayectoria adecuada en obras similares, según el criterio de la entidad. La entidad verificará estos aspectos durante la evaluación de las propuestas.' + RELLENO
      ]
    }
  ];

  return { hoy, empresas, profesionales, procesos, pliegos };
}

// Filas del Excel de experiencia de una empresa (encabezado + contratos), para el importador de Excel.
export function filasExperiencia(empresa) {
  return [ENCABEZADOS_EXPERIENCIA].concat(empresa.contratos);
}

// ---- Contratos tal como los guarda la app al importar el Excel de experiencia --------------------------------
// tests/smoke.mjs compara esto con lo que devuelve el importador real: si el importador cambia, la prueba avisa.
const ISO = /^\d{4}-\d{2}-\d{2}$/;
export function contratosParaRespaldo(empresa) {
  return empresa.contratos.map((f, i) => {
    const [numero, objeto, contratante, valor, ini, fin, part] = f;
    return {
      fila: i + 1, objeto, contratante, valor, valorRaw: String(valor), valorAjustado: false, valorNominal: false, valorActualizado: false,
      baseSmmlvActualizacion: null, fechaInicio: ISO.test(ini) ? ini : null, fechaFin: ISO.test(fin) ? fin : null, enEjecucion: false,
      duracion: null, cantidad: null, cantidadRaw: null, tipo: 'no-clasificado', actividades: null, numeroContrato: numero,
      participacion: part === '' || part == null ? null : { valor: part, unidad: 'COP' }, hoja: 'Hoja1'
    };
  });
}

// ---- Respaldo: lo que se carga en «Configuración y ayuda › Restaurar un respaldo» ----------------------------
// Cada valor de `claves` es un TEXTO (JSON serializado), igual que lo guarda la app.
export function clavesRespaldo(fict, opciones) {
  opciones = opciones || {};
  const perfiles = {}, porPerfil = {}, historial = {};
  fict.empresas.forEach(e => {
    perfiles[e.id] = e.perfil;
    const cs = contratosParaRespaldo(e);
    if (cs.length) porPerfil[e.id] = { contratos: { headers: ENCABEZADOS_EXPERIENCIA, cols: {}, contratos: cs, nHojas: 1, fuente: 'xlsx' }, meta: { expFile: e.id + '.xlsx (ficticio)', nContratos: cs.length, omitidos: null } };
  });
  const ahora = Date.parse(fict.hoy + 'T12:00:00Z');
  fict.procesos.forEach(p => {
    historial[p.id] = { etapa: 'por_revisar', etapaTs: ahora, snapshot: { entidad: p.entidad, objeto: p.objeto, valor: p.valor, closingRaw: p.closingRaw, pubRaw: p.pubRaw, modalidad: p.modalidad, fuente: p.fuente, url: p.url, referencia: p.referencia } };
  });
  const primera = fict.empresas[0].id;
  const claves = {
    perfiles_empresa: JSON.stringify(perfiles), perfil_activo_id: primera, perfiles_activos: JSON.stringify([primera]),
    experiencia_evaluacion: JSON.stringify({ porPerfil }), historial: JSON.stringify(historial), schema_version: '2'
  };
  if (!opciones.sinPersonal) { claves.perfiles_profesionales = JSON.stringify(fict.profesionales); claves.personal_activo_id = Object.keys(fict.profesionales)[0]; }
  else { claves.perfiles_profesionales = JSON.stringify({}); }
  return claves;
}

// ---- Formato Maestro de Experiencia ficticio (hojas como las de la plantilla) --------------------------------
export function hojasFormatoMaestro(fict) {
  const SUJETOS = [], CONTRATOS = [], PARTICIPACIONES = [], UNSPSC = [], CANTIDADES = [];
  let n = 0;
  const idContrato = () => 'C-' + String(++n).padStart(4, '0');
  fict.empresas.forEach((e, i) => {
    const sid = 'S-' + String(i + 1).padStart(3, '0');
    SUJETOS.push({ ID_SUJETO: sid, TIPO: 'Empresa', NOMBRE: e.perfil.nombre.replace(/^FICTICIA \d+ · /, '').replace(/ \(integrante de consorcio\)/, ''), DOCUMENTO: e.perfil.nit, CUENTA_PARA: '' });
    e.contratos.forEach(f => {
      const [numero, objeto, entidad, valor, ini, fin, part] = f;
      const id = idContrato();
      const fechaOk = d => ISO.test(d) ? d : '';
      CONTRATOS.push({ ID_CONTRATO: id, NUMERO_CONTRATO: numero, ENTIDAD: entidad, TIPO_CLIENTE: 'Público', OBJETO: objeto, ESPECIALIDAD: /puente/i.test(objeto) ? 'Puentes' : 'Vías y carreteras', TIPO_ACTIVIDAD: 'Construcción', FECHA_INICIO: fechaOk(ini), FECHA_TERMINACION: fechaOk(fin), ESTADO: e.etiqueta === 'Tibú' && numero === 'T-003' ? 'Vigente' : 'Terminado', VALOR_INICIAL: valor, VALOR_CONTRATO: valor, VALOR_EJECUTADO: valor, SOPORTE: 'Certificación ficticia' });
      PARTICIPACIONES.push({ ID_CONTRATO: id, ID_SUJETO: sid, FORMA_EJECUCION: part && part < 100 ? 'Unión temporal' : 'Individual', NOMBRE_FIGURA: part && part < 100 ? 'UT Ficticia' : '', PORCENTAJE: part ? part / 100 : 1, EN_RUP: 'Sí' });
      if (!/puente/i.test(objeto)) UNSPSC.push({ ID_CONTRATO: id, CODIGO_UNSPSC: '72141000' });
    });
    (e.perfil.contratosEnEjecucion || []).forEach(c => {
      const id = idContrato();
      CONTRATOS.push({ ID_CONTRATO: id, NUMERO_CONTRATO: c.numero, ENTIDAD: c.entidad, TIPO_CLIENTE: 'Público', OBJETO: c.nombre, ESPECIALIDAD: 'Vías y carreteras', TIPO_ACTIVIDAD: 'Construcción', FECHA_INICIO: c.fechaInicio, FECHA_TERMINACION: c.fechaFin, ESTADO: 'En ejecución', VALOR_INICIAL: c.valorInicial, VALOR_CONTRATO: c.valorActual, VALOR_EJECUTADO: c.valorEjecutado, SOPORTE: 'Acta de inicio ficticia' });
      PARTICIPACIONES.push({ ID_CONTRATO: id, ID_SUJETO: sid, FORMA_EJECUCION: 'Individual', PORCENTAJE: 1, EN_RUP: 'No' });
    });
  });
  // Un contrato en consorcio de Ocaña y Ábrego SIN porcentaje: se importa sin valor (no se adivina el reparto).
  const idC = idContrato();
  CONTRATOS.push({ ID_CONTRATO: idC, NUMERO_CONTRATO: 'K-001', ENTIDAD: 'Municipio ficticio de Roca Seca', TIPO_CLIENTE: 'Público', OBJETO: OBJ_VIAS_C, ESPECIALIDAD: 'Vías y carreteras', TIPO_ACTIVIDAD: 'Construcción', FECHA_INICIO: haceAnios(fict.hoy, 3), FECHA_TERMINACION: haceAnios(fict.hoy, 2), ESTADO: 'Terminado', VALOR_CONTRATO: 4000000000 });
  PARTICIPACIONES.push({ ID_CONTRATO: idC, ID_SUJETO: 'S-007', FORMA_EJECUCION: 'Consorcio', NOMBRE_FIGURA: 'Consorcio Ficticio Norte' });
  PARTICIPACIONES.push({ ID_CONTRATO: idC, ID_SUJETO: 'S-008', FORMA_EJECUCION: 'Consorcio', NOMBRE_FIGURA: 'Consorcio Ficticio Norte' });
  return { SUJETOS, CONTRATOS, PARTICIPACIONES, UNSPSC, CANTIDADES };
}
