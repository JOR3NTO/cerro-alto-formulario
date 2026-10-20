/*
 * Comportamiento del formulario.
 *
 * Decisiones principales:
 * - Se valida al salir de cada campo (no mientras la persona escribe, para no
 *   regañarla antes de tiempo). Si un campo ya mostró un error, se vuelve a
 *   validar con cada tecla para que el error desaparezca apenas se corrige.
 * - Al intentar enviar con errores, aparece un resumen arriba con enlaces a
 *   cada campo y el foco va a ese resumen (lectores de pantalla lo anuncian).
 * - El evento se arma una sola vez por solicitud: si el envío falla y la
 *   persona reintenta, se reenvía el MISMO event_id. Así, si el primer intento
 *   sí llegó, el sistema de leads lo reconoce como duplicado y no crea dos.
 * - Si el envío falla, los datos NO se borran.
 */
(function () {
  "use strict";

  var V = window.Validacion;
  var form = document.getElementById("formulario");
  var boton = document.getElementById("boton-enviar");
  var resumen = document.getElementById("resumen-errores");
  var resumenLista = document.getElementById("resumen-lista");
  var errorEnvio = document.getElementById("error-envio");
  var confirmacion = document.getElementById("confirmacion");
  var mensaje = document.getElementById("mensaje");
  var contador = document.getElementById("mensaje-contador");

  // Cada campo con su regla y el nombre que se usa en el resumen de errores.
  var CAMPOS = {
    nombre: { etiqueta: "Nombre", validar: function (el) { return V.validarNombre(el.value); } },
    telefono: { etiqueta: "Celular", validar: function (el) { return V.validarTelefono(el.value); } },
    servicio: { etiqueta: "Servicio", validar: function (el) { return V.validarServicio(el.value); } },
    ciudad: { etiqueta: "Ciudad", validar: function (el) { return V.validarCiudad(el.value); } },
    correo: { etiqueta: "Correo", validar: function (el) { return V.validarCorreo(el.value, false); } },
    mensaje: { etiqueta: "Mensaje", validar: function (el) { return V.validarMensaje(el.value); } },
    consentimiento: { etiqueta: "Autorización de datos", validar: function (el) { return V.validarConsentimiento(el.checked); } }
  };

  var eventoPendiente = null; // evento armado y aún no confirmado por el servidor

  function campo(id) { return document.getElementById(id); }
  function contenedor(id) { return form.querySelector('[data-campo="' + id + '"]'); }

  // Muestra u oculta el error de un campo y devuelve el resultado de la regla.
  function validarCampo(id, mostrarValido) {
    var el = campo(id);
    var r = CAMPOS[id].validar(el);
    var caja = contenedor(id);
    var p = document.getElementById(id + "-error");

    caja.classList.toggle("con-error", !r.ok);
    el.setAttribute("aria-invalid", r.ok ? "false" : "true");
    p.textContent = r.ok ? "" : r.error;

    // Sugerencia de correo con un botón para aplicarla de un toque.
    if (!r.ok && r.sugerencia) {
      p.textContent = "";
      p.appendChild(document.createTextNode("¿Quisiste decir "));
      var b = document.createElement("button");
      b.type = "button";
      b.className = "boton-sugerencia";
      b.textContent = r.sugerencia;
      b.addEventListener("click", function () {
        el.value = r.sugerencia;
        validarCampo(id, true);
        el.focus();
      });
      p.appendChild(b);
      p.appendChild(document.createTextNode("? Tócalo para corregirlo."));
    }

    // Marca de válido solo en campos con contenido (no en opcionales vacíos).
    var conValor = el.type === "checkbox" ? el.checked : !!String(el.value).trim();
    caja.classList.toggle("valido", r.ok && conValor && !!mostrarValido);

    if (id === "nombre" && r.ok && el.value.trim() !== r.valor) el.value = r.valor;

    // El teléfono válido se reescribe con espacios para que la persona lo revise fácil.
    if (id === "telefono" && r.ok && r.formato && el.value !== r.formato) el.value = r.formato;
    return r;
  }

  // Validación al salir del campo y revalidación en vivo si ya tenía error.
  Object.keys(CAMPOS).forEach(function (id) {
    var el = campo(id);
    var tocado = false;
    el.addEventListener("blur", function () {
      // No marcar error en un campo vacío solo por pasar con Tab: la casilla
      // y los campos sin tocar se revisan al enviar.
      if (el.type === "checkbox") return;
      var vacio = !String(el.value).trim();
      if (vacio && !tocado) return;
      validarCampo(id, true);
    });
    el.addEventListener("input", function () {
      tocado = true;
      if (contenedor(id).classList.contains("con-error")) validarCampo(id, false);
    });
    el.addEventListener("change", function () {
      if (el.tagName === "SELECT" || el.type === "checkbox") validarCampo(id, true);
    });
  });

  // Contador de caracteres del mensaje.
  function actualizarContador() {
    contador.textContent = mensaje.value.length + " de " + V.MAX_MENSAJE;
  }
  mensaje.addEventListener("input", actualizarContador);

  // Texto de "cuándo te llamamos", según la hora de Ecuador.
  function textoCuando() {
    var c = V.cuandoRespondemos(new Date());
    return c.abierto ? "hoy mismo" : c.texto;
  }
  document.getElementById("cuando").textContent = textoCuando();

  function mostrarResumen(errores) {
    resumenLista.innerHTML = "";
    errores.forEach(function (e) {
      var li = document.createElement("li");
      // El enlace lleva solo el nombre del campo; el mensaje va como texto normal.
      var a = document.createElement("a");
      a.href = "#" + e.id;
      a.textContent = e.etiqueta;
      a.addEventListener("click", function (ev) {
        ev.preventDefault();
        campo(e.id).focus();
      });
      li.appendChild(a);
      li.appendChild(document.createTextNode(": " + e.error));
      resumenLista.appendChild(li);
    });
    resumen.hidden = false;
    resumen.focus();
  }

  function armarEvento(datos) {
    // Mismo formato que el conector de Meta, con platform "web" y sin campaña.
    return {
      event_id: "evt_web_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      event_type: "lead.created",
      created_at: new Date().toISOString(),
      source: { platform: "web", campaign: null, form_id: "frm_web_contacto" },
      lead: {
        full_name: datos.nombre,
        phone: datos.telefono,          // ya en formato internacional: +593991234567
        email: datos.correo || null,    // opcional: null si no lo escribió
        city: datos.ciudad || null,
        service_interest: datos.servicio,
        message: datos.mensaje || null
      }
    };
  }

  function enviarAlSistema(evento) {
    if (!window.WEBHOOK_URL) {
      // Modo de prueba: no se envía nada, se muestra el evento en la consola.
      console.log("Evento que se enviaría al sistema de leads:", evento);
      return Promise.resolve();
    }
    // Se corta a los 15 s para no dejar a la persona esperando sin respuesta.
    var control = typeof AbortController !== "undefined" ? new AbortController() : null;
    var corte = control ? setTimeout(function () { control.abort(); }, 15000) : null;
    return fetch(window.WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(evento),
      signal: control ? control.signal : undefined
    }).then(function (res) {
      if (corte) clearTimeout(corte);
      if (!res.ok) throw new Error("HTTP " + res.status);
    }, function (err) {
      if (corte) clearTimeout(corte);
      throw err;
    });
  }

  function ponerEnviando(si) {
    boton.disabled = si;
    boton.classList.toggle("enviando", si);
    boton.querySelector(".boton-texto").textContent = si ? "Enviando…" : "Enviar solicitud";
  }

  function mostrarConfirmacion(datos, formato) {
    var c = V.cuandoRespondemos(new Date());
    document.getElementById("confirmacion-nombre").textContent = datos.nombre.split(" ")[0];
    document.getElementById("confirmacion-telefono").textContent = formato;
    document.getElementById("confirmacion-cuando").textContent = c.abierto
      ? "Te contactamos hoy mismo, dentro del horario de atención."
      : "Ahora estamos fuera del horario de atención. Te contactamos " + c.texto + ".";
    form.hidden = true;
    resumen.hidden = true;
    confirmacion.hidden = false;
    confirmacion.focus();
    window.scrollTo({ top: confirmacion.getBoundingClientRect().top + window.pageYOffset - 16 });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    errorEnvio.hidden = true;

    // 1. Validar todo y juntar errores en el orden en que aparecen los campos.
    var datos = {}, errores = [], formatoTel = "";
    Object.keys(CAMPOS).forEach(function (id) {
      var r = validarCampo(id, true);
      datos[id] = r.valor;
      if (id === "telefono" && r.ok) formatoTel = r.formato;
      if (!r.ok) errores.push({ id: id, etiqueta: CAMPOS[id].etiqueta, error: r.error });
    });
    if (errores.length) {
      mostrarResumen(errores);
      return;
    }
    resumen.hidden = true;

    // 2. Bot: si llenó el campo trampa, se finge el éxito y no se envía nada.
    if (campo("sitio_web").value) {
      mostrarConfirmacion(datos, formatoTel);
      return;
    }

    // 3. Armar el evento una sola vez y enviarlo.
    if (!eventoPendiente) eventoPendiente = armarEvento(datos);
    else eventoPendiente.lead = armarEvento(datos).lead; // si corrigió algo, se actualiza

    ponerEnviando(true);
    enviarAlSistema(eventoPendiente).then(function () {
      eventoPendiente = null;
      ponerEnviando(false);
      mostrarConfirmacion(datos, formatoTel);
    }, function () {
      ponerEnviando(false);
      errorEnvio.textContent = "No pudimos enviar tu solicitud. Tus datos siguen aquí: vuelve a intentarlo en un momento o llámanos al +593\u00a02\u00a0000\u00a04400.";
      errorEnvio.hidden = false;
    });
  });

  // Nueva solicitud: limpia todo.
  document.getElementById("otra-solicitud").addEventListener("click", function () {
    form.reset();
    actualizarContador();
    Object.keys(CAMPOS).forEach(function (id) {
      contenedor(id).classList.remove("con-error", "valido");
      campo(id).removeAttribute("aria-invalid");
    });
    confirmacion.hidden = true;
    form.hidden = false;
    campo("nombre").focus();
  });
})();
