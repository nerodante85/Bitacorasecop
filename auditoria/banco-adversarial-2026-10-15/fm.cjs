const FM = require('../../formatomaestro.js');
console.log(Object.keys(FM));
console.log('numero', ['1.200.000.000','1,5','-5','abc','','1e9', 0, '0'].map(x => JSON.stringify(x) + '=>' + FM.numero(x)).join(' | '));
console.log('porcentaje', ['50%','0,5','150','0','-10','abc','', 50, 0.5, '100'].map(x => JSON.stringify(x) + '=>' + FM.porcentaje(x)).join(' | '));
console.log('fecha', ['2024-02-30','12/2/94','31/12/2023','45000', 45000, '9999-12-31','1850-01-01',''].map(x => JSON.stringify(x) + '=>' + FM.fechaISO(x)).join(' | '));
