import M from '/home/user/Bitacorasecop/magnitudes.js';
const f1='Por lo menos uno (1) de los contratos válidos aportados deberá acreditar una longitud de tubería mayor o igual a 965,21 ml (50%) de la longitud total de 1.930,42 ml, la cual es de 1.930,42 ml, el cual corresponde a PVC, con diámetro mayor o igual a 8" ';
const f2='Por lo menos uno (1) de los contratos válidos aportados deberá acreditar una longitud de tubería mayor o igual a 965,21 ml en PVC con diámetro mayor o igual a 200 mm';
const f3='Por lo menos uno (1) de los contratos válidos aportados deberá acreditar una longitud de tubería de 1.000 ml el cual corresponde a PVC con diámetro mayor o igual a 8" y menor o igual a 12"';
for (const f of [f1,f2,f3]) { const ex=M.parsearExigencia(f); console.log(JSON.stringify(ex));
 const c=[{numeroContrato:'X',participacion:{valor:100},formatoMaestro:{cantidades:[{item:'Tubería PVC alcantarillado Ø24"',cantidad:1500,unidad:'ml'},{item:'Tubería PVC Ø10"',cantidad:300,unidad:'ml'}]}}];
 const r=M.evaluar(ex,c,{}); console.log('  =>',r.estado,r.detalle.slice(0,140)); }
