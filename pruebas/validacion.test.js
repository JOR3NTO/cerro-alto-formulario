// Pruebas de las reglas de validación. Correr con: node --test pruebas/
const test = require("node:test");
const assert = require("node:assert");
const V = require("../validacion.js");

test("teléfono: formas comunes de un celular de Ecuador quedan en E.164", () => {
  for (const t of ["0991234567", "099 123 4567", "099-123-4567", "(099) 123 4567", "+593 99 123 4567", "593991234567", "00593991234567", "991234567"]) {
    const r = V.validarTelefono(t);
    assert.ok(r.ok, t);
    assert.strictEqual(r.valor, "+593991234567", t);
  }
});

test("teléfono: fijo de Quito y número extranjero", () => {
  assert.strictEqual(V.validarTelefono("02 234 5678").valor, "+59322345678");
  assert.strictEqual(V.validarTelefono("+593 2 234 5678").valor, "+59322345678");
  assert.strictEqual(V.validarTelefono("+57 300 123 4567").valor, "+573001234567");
});

test("teléfono: errores con mensaje que dice cómo corregir", () => {
  assert.match(V.validarTelefono("").error, /celular/);
  assert.match(V.validarTelefono("099 123 45").error, /Faltan dígitos/);
  assert.match(V.validarTelefono("099 123 456 78").error, /Sobran dígitos/);
  assert.match(V.validarTelefono("no tengo").error, /solo números/);
  assert.match(V.validarTelefono("0812345678").error, /empiezan por 09/);
  assert.match(V.validarTelefono("02 234 567").error, /9 dígitos/);
});

test("correo: opcional, en minúsculas y con sugerencia de errores de dedo", () => {
  assert.deepStrictEqual(V.validarCorreo("", false), { ok: true, valor: "", error: "" });
  assert.strictEqual(V.validarCorreo("  Ana.Torres@Gmail.com ").valor, "ana.torres@gmail.com");
  assert.ok(V.validarCorreo("ana@clinica-ejemplo.ec").ok);
  assert.match(V.validarCorreo("ana@gmial.com").error, /ana@gmail\.com/);
  assert.match(V.validarCorreo("ana@hotmail.con").error, /ana@hotmail\.com/);
  assert.match(V.validarCorreo("ana@gmail").error, /gmail\.com|después de la @/);
  assert.match(V.validarCorreo("anagmail.com").error, /falta la @/);
  assert.match(V.validarCorreo("ana @gmail.com").error, /espacios/);
});

test("nombre, servicio, ciudad, mensaje y consentimiento", () => {
  assert.ok(!V.validarNombre("   ").ok);
  assert.match(V.validarNombre("0991234567").error, /números/);
  assert.strictEqual(V.validarNombre("  ana   torres ").valor, "Ana Torres");
  assert.strictEqual(V.validarNombre("MARÍA JOSÉ ÁLVAREZ").valor, "María José Álvarez");
  assert.strictEqual(V.validarNombre("Juan de la Cruz").valor, "Juan de la Cruz");
  assert.ok(!V.validarServicio("").ok);
  assert.ok(V.validarCiudad("").ok);
  assert.ok(!V.validarCiudad("170150").ok);
  assert.ok(!V.validarMensaje("x".repeat(501)).ok);
  assert.ok(!V.validarConsentimiento(false).ok);
});

test("cuándo responde la clínica (hora de Ecuador = UTC-5)", () => {
  // Lunes 19 oct 2026, 10:00 en Quito = 15:00 UTC → abierto
  assert.strictEqual(V.cuandoRespondemos(new Date("2026-10-19T15:00:00Z")).texto, "hoy mismo");
  // Lunes 17:30 (última hora antes del cierre) → ya no se promete hoy
  assert.strictEqual(V.cuandoRespondemos(new Date("2026-10-19T22:30:00Z")).texto, "mañana martes desde las 08:00");
  // Lunes 19 oct 2026, 22:00 en Quito → mañana martes desde las 08:00
  assert.strictEqual(V.cuandoRespondemos(new Date("2026-10-20T03:00:00Z")).texto, "mañana martes desde las 08:00");
  // Sábado 24 oct, 15:00 en Quito → el lunes
  assert.strictEqual(V.cuandoRespondemos(new Date("2026-10-24T20:00:00Z")).texto, "el lunes desde las 08:00");
  // Domingo 1 nov, 12:00 → lunes 2 y martes 3 son feriados → el miércoles
  assert.strictEqual(V.cuandoRespondemos(new Date("2026-11-01T17:00:00Z")).texto, "el miércoles desde las 08:00");
  // Lunes 7:00 → hoy desde las 08:00
  assert.strictEqual(V.cuandoRespondemos(new Date("2026-10-19T12:00:00Z")).texto, "hoy desde las 08:00");
});
