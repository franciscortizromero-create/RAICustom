// Impresión / PDF: abre una ventana con membrete RAI y lanza el diálogo de
// impresión del navegador (que permite "Guardar como PDF").

const ESTILOS = `
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Public Sans', 'Segoe UI', Arial, sans-serif; color: #1c2433; padding: 28px; font-size: 13px; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 4px solid #ffc400; padding-bottom: 14px; margin-bottom: 18px; }
  .logo { width: 54px; height: 54px; border-radius: 10px; background: #ffc400; color: #06224e; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 18px; }
  .head h1 { font-size: 19px; color: #06224e; }
  .head .sub { font-size: 11px; color: #5d6b81; }
  .doc-tipo { margin-left: auto; text-align: right; }
  .doc-tipo .t { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #5d6b81; }
  .doc-tipo .f { font-size: 22px; font-weight: 800; color: #0b3b8c; }
  table { width: 100%; border-collapse: collapse; margin: 12px 0; }
  th { text-align: left; font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.5px; color: #5d6b81; border-bottom: 2px solid #dde3ec; padding: 6px 8px; }
  td { padding: 7px 8px; border-bottom: 1px solid #eef1f6; vertical-align: top; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin: 10px 0; }
  .grid .lbl { font-size: 10.5px; text-transform: uppercase; color: #5d6b81; letter-spacing: 0.5px; }
  .grid .val { font-weight: 600; }
  .total { text-align: right; font-size: 17px; font-weight: 800; color: #0b3b8c; margin-top: 8px; }
  .firmas { display: flex; gap: 40px; margin-top: 56px; }
  .firmas div { flex: 1; border-top: 1.5px solid #1c2433; padding-top: 6px; text-align: center; font-size: 11px; color: #5d6b81; }
  .lema { margin-top: 28px; text-align: center; font-size: 10.5px; color: #5d6b81; font-style: italic; }
  @media print { body { padding: 10mm; } }
`

export function imprimir(titulo: string, cuerpoHTML: string, tipoDoc: string, folio: string) {
  const win = window.open('', '_blank', 'width=860,height=720')
  if (!win) {
    alert('El navegador bloqueó la ventana de impresión. Permite las ventanas emergentes para este sitio.')
    return
  }
  win.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${titulo}</title>
  <style>${ESTILOS}</style>
</head>
<body>
  <div class="head">
    <div class="logo">RAI</div>
    <div>
      <h1>RAI · Hojalatería y Pintura</h1>
      <div class="sub">Av. de la Convención Pte. No. 710 · Aguascalientes, Ags. · Especialistas en reparación de autos</div>
    </div>
    <div class="doc-tipo">
      <div class="t">${tipoDoc}</div>
      <div class="f">${folio}</div>
    </div>
  </div>
  ${cuerpoHTML}
  <p class="lema">"Haz a los demás lo que a ti te gustaría"</p>
  <script>window.onload = () => { window.print() }<\/script>
</body>
</html>`)
  win.document.close()
}
