/*
 * Reglas de validación del formulario.
 *
 * Están separadas de script.js para poder probarlas sin navegador
 * (node --test pruebas/). Cada función recibe el texto tal como lo
 * escribió la persona y devuelve { ok, valor, error }:
 *   - valor: el dato limpio que se envía al sistema.
 *   - error: un mensaje que dice cómo corregir, no solo que está mal.
 */
(function (global) {
  "use strict";

  // ---------- Nombre ----------
  function validarNombre(texto) {
    var valor = String(texto || "").replace(/\s+/g, " ").trim();
    if (!valor) {
      return { ok: false, valor: valor, error: "Escribe tu nombre para saber cómo dirigirnos a ti." };
    }
    if (/\d/.test(valor)) {
      return { ok: false, valor: valor, error: "El nombre no lleva números. Revisa que no hayas escrito aquí tu teléfono." };
    }
    if (valor.replace(/[^A-Za-zÀ-ÿ]/g, "").length < 2) {
      return { ok: false, valor: valor, error: "Escribe al menos tu nombre, por ejemplo: Ana Torres." };
    }
    // Si viene todo en minúsculas o todo en mayúsculas ("ana torres", "ANA TORRES"),
    // se deja como nombre propio para que recepción lo lea bien en el aviso.
    if (valor === valor.toLowerCase() || valor === valor.toUpperCase()) {
      valor = valor.toLowerCase().replace(/(^|[\s'-])([a-zà-ÿ])/g, function (m, sep, letra) {
        return sep + letra.toUpperCase();
      });
    }
    return { ok: true, valor: valor, error: "" };
  }

  // ---------- Teléfono (Ecuador por defecto) ----------
  // Acepta lo que la gente escribe de verdad: "099 123 4567", "099-123-4567",
  // "+593 99 123 4567", "593991234567", "02 234 5678".
  // Devuelve el número en formato internacional E.164 (+593...), que es el
  // mismo que usa el sistema de leads para detectar duplicados.
  function validarTelefono(texto) {
    var crudo = String(texto || "").trim();
    if (!crudo) {
      return { ok: false, valor: "", error: "Escribe tu número de celular para poder llamarte." };
    }
    if (/[A-Za-z]/.test(crudo)) {
      return { ok: false, valor: crudo, error: "Usa solo números. Puedes separarlos con espacios, por ejemplo: 099 123 4567." };
    }
    var digitos = crudo.replace(/\D/g, "");
    var internacional = crudo.charAt(0) === "+" || crudo.indexOf("00") === 0;
    if (crudo.indexOf("00") === 0) digitos = digitos.slice(2);

    // Número de otro país: se acepta con código internacional (+57, +1, ...).
    if (internacional && digitos.indexOf("593") !== 0) {
      if (digitos.length >= 8 && digitos.length <= 15) {
        return { ok: true, valor: "+" + digitos, error: "", formato: "+" + digitos };
      }
      return { ok: false, valor: crudo, error: "Revisa el número: con código de otro país debe tener entre 8 y 15 dígitos." };
    }

    // Número de Ecuador: se lleva a la forma nacional (sin 593, con 0 inicial).
    var nacional = digitos;
    if (nacional.indexOf("593") === 0 && nacional.length >= 11) nacional = "0" + nacional.slice(3);
    if (nacional.charAt(0) !== "0") nacional = "0" + nacional;

    // Celular: 09 + 8 dígitos (10 en total).
    if (/^09/.test(nacional)) {
      if (nacional.length < 10) {
        return { ok: false, valor: crudo, error: "Faltan dígitos: un celular de Ecuador tiene 10, por ejemplo: 099 123 4567." };
      }
      if (nacional.length > 10) {
        return { ok: false, valor: crudo, error: "Sobran dígitos: un celular de Ecuador tiene 10, por ejemplo: 099 123 4567." };
      }
      return {
        ok: true,
        valor: "+593" + nacional.slice(1),
        error: "",
        formato: nacional.slice(0, 3) + " " + nacional.slice(3, 6) + " " + nacional.slice(6)
      };
    }

    // Fijo: 0 + código de provincia (2 a 7) + 7 dígitos (9 en total).
    if (/^0[2-7]/.test(nacional)) {
      if (nacional.length !== 9) {
        return { ok: false, valor: crudo, error: "Revisa el número: un teléfono fijo tiene 9 dígitos con el código de provincia, por ejemplo: 02 234 5678." };
      }
      return {
        ok: true,
        valor: "+593" + nacional.slice(1),
        error: "",
        formato: nacional.slice(0, 2) + " " + nacional.slice(2, 5) + " " + nacional.slice(5)
      };
    }

    return { ok: false, valor: crudo, error: "Revisa el número: los celulares de Ecuador empiezan por 09, por ejemplo: 099 123 4567." };
  }

  // ---------- Correo (opcional, pero si se escribe tiene que servir) ----------
  var DOMINIOS = ["gmail.com", "hotmail.com", "outlook.com", "yahoo.com", "icloud.com", "live.com", "hotmail.es", "yahoo.es", "outlook.es"];

  // Distancia de edición, para sugerir "gmail.com" cuando escriben "gmial.com".
  function distancia(a, b) {
    var fila = [];
    for (var j = 0; j <= b.length; j++) fila[j] = j;
    for (var i = 1; i <= a.length; i++) {
      var previo = fila[0];
      fila[0] = i;
      for (var k = 1; k <= b.length; k++) {
        var temp = fila[k];
        fila[k] = Math.min(fila[k] + 1, fila[k - 1] + 1, previo + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1));
        previo = temp;
      }
    }
    return fila[b.length];
  }

  function sugerirDominio(dominio) {
    if (DOMINIOS.indexOf(dominio) !== -1) return "";
    // Terminaciones mal escritas: .con, .cmo, .co (cuando el resto es un dominio conocido)
    var arreglado = dominio.replace(/\.(con|cmo|ocm|comm|om)$/, ".com");
    if (arreglado !== dominio) return arreglado;
    var mejor = "", menor = 3;
    DOMINIOS.forEach(function (d) {
      var dist = distancia(dominio, d);
      if (dist > 0 && dist < menor) { menor = dist; mejor = d; }
    });
    return mejor;
  }

  function validarCorreo(texto, obligatorio) {
    var valor = String(texto || "").trim().toLowerCase();
    if (!valor) {
      return obligatorio
        ? { ok: false, valor: "", error: "Escribe tu correo." }
        : { ok: true, valor: "", error: "" };
    }
    if (/\s/.test(valor)) {
      return { ok: false, valor: valor, error: "El correo no lleva espacios. Revisa que esté escrito todo junto." };
    }
    var partes = valor.split("@");
    if (partes.length !== 2 || !partes[0]) {
      return { ok: false, valor: valor, error: "Al correo le falta la @, por ejemplo: ana@gmail.com." };
    }
    var dominio = partes[1];
    if (!/^[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}$/.test(dominio) || !/^[a-z0-9._%+-]+$/.test(partes[0])) {
      var sugerido = sugerirDominio(dominio);
      return {
        ok: false,
        valor: valor,
        error: sugerido
          ? "Revisa el correo. ¿Quisiste decir " + partes[0] + "@" + sugerido + "?"
          : "Revisa lo que va después de la @, por ejemplo: ana@gmail.com."
      };
    }
    var sugerencia = sugerirDominio(dominio);
    // Un correo con forma válida pero con un dominio casi igual a uno común
    // (gmial.com, hotmial.com) casi siempre es un error de dedo: se pide confirmar.
    if (sugerencia) {
      return { ok: false, valor: valor, error: "¿Quisiste decir " + partes[0] + "@" + sugerencia + "? Corrígelo para que te llegue la confirmación.", sugerencia: partes[0] + "@" + sugerencia };
    }
    return { ok: true, valor: valor, error: "" };
  }

  // ---------- Servicio ----------
  function validarServicio(valor) {
    return valor
      ? { ok: true, valor: valor, error: "" }
      : { ok: false, valor: "", error: "Elige un servicio. Si no sabes cuál, elige \"Valoración\" y te orientamos." };
  }

  // ---------- Ciudad (opcional) ----------
  function validarCiudad(texto) {
    var valor = String(texto || "").replace(/\s+/g, " ").trim();
    if (valor && /\d/.test(valor)) {
      return { ok: false, valor: valor, error: "Escribe solo el nombre de la ciudad o el sector, por ejemplo: Quito o Cumbayá." };
    }
    return { ok: true, valor: valor, error: "" };
  }

  // ---------- Mensaje (opcional) ----------
  var MAX_MENSAJE = 500;
  function validarMensaje(texto) {
    var valor = String(texto || "").trim();
    if (valor.length > MAX_MENSAJE) {
      return { ok: false, valor: valor, error: "El mensaje es muy largo: déjalo en " + MAX_MENSAJE + " caracteres o menos." };
    }
    return { ok: true, valor: valor, error: "" };
  }

  // ---------- Consentimiento ----------
  function validarConsentimiento(marcado) {
    return marcado
      ? { ok: true, valor: true, error: "" }
      : { ok: false, valor: false, error: "Para poder contactarte necesitamos tu autorización. Marca la casilla." };
  }

  // ---------- Cuándo responde la clínica ----------
  // Horario de los asesores (hora de Ecuador): lunes a viernes 08:00–18:00,
  // sábado 09:00–13:00. Domingos y feriados no atienden.
  var FERIADOS = ["2026-11-02", "2026-11-03", "2026-12-25", "2027-01-01"];
  var HORARIO = { 1: [8, 18], 2: [8, 18], 3: [8, 18], 4: [8, 18], 5: [8, 18], 6: [9, 13] };
  var DIAS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

  // Hora de Ecuador (UTC-5 fijo, sin horario de verano), sin depender
  // de la zona horaria del celular de la persona.
  function horaEcuador(fecha) {
    return new Date(fecha.getTime() - 5 * 3600 * 1000);
  }
  function claveDia(d) {
    return d.toISOString().slice(0, 10);
  }

  function cuandoRespondemos(ahora) {
    var ec = horaEcuador(ahora || new Date());
    var hora = ec.getUTCHours() + ec.getUTCMinutes() / 60;
    var dia = ec.getUTCDay();
    var hoy = HORARIO[dia];
    // En la última hora antes del cierre ya no se promete "hoy": se pasa al siguiente día hábil.
    if (hoy && FERIADOS.indexOf(claveDia(ec)) === -1 && hora >= hoy[0] && hora < hoy[1] - 1) {
      return { abierto: true, texto: "hoy mismo" };
    }
    // Buscar el siguiente día hábil.
    var d = new Date(ec.getTime());
    for (var i = 0; i < 8; i++) {
      var h = HORARIO[d.getUTCDay()];
      var esHoy = i === 0;
      if (h && FERIADOS.indexOf(claveDia(d)) === -1 && (!esHoy || hora < h[0])) {
        var cuando = esHoy ? "hoy" : (i === 1 ? "mañana " + DIAS[d.getUTCDay()] : "el " + DIAS[d.getUTCDay()]);
        return { abierto: false, texto: cuando + " desde las " + (h[0] < 10 ? "0" : "") + h[0] + ":00" };
      }
      d = new Date(d.getTime() + 24 * 3600 * 1000);
    }
    return { abierto: false, texto: "el siguiente día hábil" };
  }

  var api = {
    validarNombre: validarNombre,
    validarTelefono: validarTelefono,
    validarCorreo: validarCorreo,
    validarServicio: validarServicio,
    validarCiudad: validarCiudad,
    validarMensaje: validarMensaje,
    validarConsentimiento: validarConsentimiento,
    cuandoRespondemos: cuandoRespondemos,
    MAX_MENSAJE: MAX_MENSAJE
  };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Validacion = api;
})(this);
