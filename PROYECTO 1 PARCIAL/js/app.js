import { EXERCISES, NAV_ITEMS, SPORTS } from "./data.js";
import { consumeLoadError, exportState, loadState, saveState, STORAGE_KEY, validateState } from "./storage.js";
import { dateKey, escapeHTML as e, formatDate, formatDuration, getWeekDates, today } from "./utils.js";

const app = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
let state = loadState();
const initialLoadError = consumeLoadError();
let activeView = "dashboard";
let onboardingStep = 0;
let calendarWeekOffset = 0;
let exerciseFilter = "Todos";
let searchQuery = "";
let toastTimer;
let session = null;
let tickHandle = null;
let chartResizeHandle;
let routineWarningMessage = "";
const sessionCredentials = new Map();
const EXERCISE_BY_ID = new Map(EXERCISES.map(item => [item.id, item]));

function persist() {
  try {
    saveState(state);
  } catch (error) {
    notify(`No se pudieron guardar los cambios: ${error.message}`, "error");
  }
}

function notify(message, type = "success") {
  clearTimeout(toastTimer);
  toastRegion.innerHTML = `<div class="toast toast-${type}" role="alert">${e(message)}</div>`;
  toastTimer = setTimeout(() => { toastRegion.innerHTML = ""; }, 4200);
}

function avatar() {
  const name = state.profile.name.trim();
  return name ? e(name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase()) : "OC";
}

function shell(content) {
  const firstName = state.profile.name.trim().split(/\s+/)[0] || "Atleta";
  app.innerHTML = `
    <div class="app-shell">
      <aside class="sidebar" id="sidebar" aria-label="Navegación principal">
        <a class="brand" href="#dashboard" aria-label="ONNY COACH, inicio">
          <span class="brand-mark" aria-hidden="true"><span>O</span><i></i></span>
          <span class="brand-word">ONNY<span>COACH</span><small>TRAIN SMART. FEEL STRONG.</small></span>
        </a>
        <div class="sidebar-label">MENÚ PRINCIPAL</div>
        <nav class="main-nav">${NAV_ITEMS.map(([id, label, icon]) => `<a href="#${id}" class="nav-link ${activeView === id ? "active" : ""}" data-view="${id}" ${activeView === id ? 'aria-current="page"' : ""}><span class="nav-icon" aria-hidden="true">${icon}</span><span>${label}</span>${id === "workout" && session ? '<span class="live-dot" aria-label="Entrenamiento activo"></span>' : ""}</a>`).join("")}</nav>
        <div class="sidebar-bottom">
          <div class="mascot-card"><div class="mascot" aria-hidden="true"><span class="mascot-whistle">◆</span><span class="mascot-watch">◷</span><span class="mascot-face">◡</span></div><strong>¡Vamos, ${e(firstName)}!</strong><p>Un paso a la vez. Tu constancia cuenta.</p></div>
          <button class="user-chip" data-action="logout"><span class="avatar">${avatar()}</span><span class="user-chip-copy"><strong>${e(state.profile.name || "Atleta")}</strong><small>Cerrar sesión</small></span><span class="logout-icon" aria-hidden="true">↗</span></button>
        </div>
      </aside>
      <div class="mobile-scrim" data-action="close-menu"></div>
      <main class="main-area" id="main-content">
        <header class="topbar">
          <button class="menu-toggle" data-action="toggle-menu" aria-label="Abrir menú" aria-expanded="false">☰</button>
          <div class="breadcrumb"><span>ONNY COACH</span><b>/</b><strong>${e(NAV_ITEMS.find(item => item[0] === activeView)?.[1] || "Inicio")}</strong></div>
          <div class="topbar-actions"><span class="today-label">${new Intl.DateTimeFormat("es", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span><button class="top-avatar" data-view="profile" aria-label="Ir a mi perfil">${avatar()}</button></div>
        </header>
        <div class="page-content">${content}</div>
        <footer class="footer-note">ONNY COACH <span>·</span> Tu progreso, a tu ritmo <span>·</span> Herramienta educativa, no sustituye asesoramiento profesional</footer>
      </main>
    </div>`;
  requestAnimationFrame(drawCharts);
}

function authScreen() {
  app.innerHTML = `<main class="auth-page"><section class="auth-card">
    <div class="brand auth-brand" aria-label="ONNY COACH"><span class="brand-mark"><span>O</span><i></i></span><span class="brand-word">ONNY<span>COACH</span><small>TRAIN SMART. FEEL STRONG.</small></span></div>
    <div class="auth-art"><div class="auth-orbit orbit-one"></div><div class="auth-orbit orbit-two"></div><div class="auth-mascot"><span class="mascot-whistle">◆</span><span class="mascot-watch">◷</span><span class="mascot-face">◡</span></div><span class="auth-stamp">MOVE<br>WITH<br>INTENTION</span></div>
    <div class="auth-copy"><span class="eyebrow">TU ESPACIO DE ENTRENAMIENTO</span><h1>Tu mejor versión<br>se construye <em>hoy.</em></h1><p>Crea una cuenta local para organizar rutinas, registrar sesiones y seguir tu progreso.</p></div>
    <div class="auth-tabs" role="tablist"><button class="auth-tab active" data-auth-mode="register" role="tab" aria-selected="true">Crear cuenta</button><button class="auth-tab" data-auth-mode="login" role="tab" aria-selected="false">Iniciar sesión</button></div>
    <form id="auth-form" class="auth-form" novalidate>
      <div class="field auth-name"><label for="auth-name">Nombre</label><input id="auth-name" name="name" autocomplete="name" required minlength="2" placeholder="Tu nombre"></div>
      <div class="field"><label for="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" autocomplete="email" required placeholder="tu@correo.com"></div>
      <div class="field"><label for="auth-password">Contraseña de demostración</label><input id="auth-password" name="password" type="password" autocomplete="current-password" required minlength="8" placeholder="Al menos 8 caracteres"><small>No se guarda ni se envía. La autenticación local no es segura ni verificable en producción.</small></div>
      <button class="button button-primary full-width" type="submit"><span class="auth-submit-label">Crear mi espacio</span><span aria-hidden="true">→</span></button>
    </form>
    <p class="auth-disclaimer">Tus datos de entrenamiento se guardan solo en este navegador. No incluyas información sensible.</p>
    <button class="button button-quiet visitor-button" data-action="visitor">Continuar como visitante</button>
  </section><div class="auth-side"><div class="auth-side-content"><span class="eyebrow">ENTRENA CON INTENCIÓN</span><h2>Pequeños hábitos.<br><em>Grandes cambios.</em></h2><p>Planifica tu semana, conoce tus avances y vuelve a empezar cada día.</p><div class="auth-features"><span>01 — Rutinas a tu medida</span><span>02 — Progreso que puedes ver</span><span>03 — Acompañamiento local</span></div></div><span class="auth-side-foot">ONNY COACH · DEMO LOCAL</span></div></main>`;
}

function enterApp({ name, email }, message) {
  if (name) state.profile.name = name.trim().slice(0, 60);
  if (email) state.profile.email = email.trim().toLowerCase().slice(0, 120);
  persist();
  sessionStorage.setItem("onny-coach-session", "active");
  activeView = "dashboard";
  render();
  notify(message);
}

function render() {
  if (sessionStorage.getItem("onny-coach-session") !== "active") return authScreen();
  if (!state.profile.onboardingComplete) {
    onboardingScreen();
    return;
  }
  const renderers = { dashboard: dashboardView, routines: routinesView, exercises: exercisesView, workout: workoutView, calendar: calendarView, progress: progressView, tools: toolsView, assistant: assistantView, profile: profileView, settings: settingsView };
  shell((renderers[activeView] || dashboardView)());
}

function onboardingScreen() {
  const profile = state.profile;
  const selectedSports = profile.sports.length ? profile.sports : (profile.mainSport ? [profile.mainSport] : []);
  const sportOptions = SPORTS.map(sport => `<option value="${sport.id}" ${sport.id === profile.mainSport ? "selected" : ""}>${e(sport.name)}</option>`).join("");
  app.innerHTML = `<main class="onboarding-page"><section class="onboarding-card">
    <header class="onboarding-header"><div class="brand onboarding-brand"><span class="brand-mark"><span>O</span><i></i></span><span class="brand-word">ONNY<span>COACH</span><small>TRAIN SMART. FEEL STRONG.</small></span></div><span class="local-badge"><i></i> TU INFORMACIÓN SE GUARDA AQUÍ</span></header>
    <div class="onboarding-intro"><span class="eyebrow">EMPEZAMOS POR TI</span><h1>Conozcamos tu forma de <em>entrenar.</em></h1><p>Con tus respuestas prepararemos una guía complementaria al deporte que practicas. Los datos físicos son opcionales; no pedimos talla de ropa.</p></div>
    <div class="onboarding-progress" aria-label="Progreso del cuestionario"><div class="onboarding-steps">${["Sobre ti", "Tus deportes", "Tu plan"].map((label, index) => `<div class="onboarding-step ${index === onboardingStep ? "current" : index < onboardingStep ? "done" : ""}"><span>${index < onboardingStep ? "✓" : `0${index + 1}`}</span><small>${label}</small></div>`).join("")}</div><div class="progress-track"><span style="width:${Math.round((onboardingStep + 1) / 3 * 100)}%"></span></div></div>
    <form id="onboarding-form" novalidate>
      <section class="onboarding-panel" data-onboarding-step="0" ${onboardingStep === 0 ? "" : "hidden"}><div class="step-heading"><span class="eyebrow">01 / DATOS PERSONALES</span><h2>¿Cómo te llamamos?</h2><p>Usaremos esta información para personalizar tu panel. La talla de ropa no es necesaria para planificar ejercicios.</p></div><div class="form-grid">
        <div class="field"><label for="onboarding-name">Nombre para mostrar <span class="required-mark">*</span></label><input id="onboarding-name" name="name" required minlength="2" maxlength="60" value="${e(profile.name)}" autocomplete="name" placeholder="Tu nombre"></div>
        <div class="field"><label for="onboarding-age">Edad <span class="optional-mark">opcional</span></label><input id="onboarding-age" name="age" type="number" min="13" max="110" step="1" value="${e(profile.age)}" placeholder="Ej. 25"><small>Solo mayores de 13 años pueden usar esta demo.</small></div>
        <div class="field"><label for="onboarding-height">Estatura (cm) <span class="optional-mark">opcional</span></label><input id="onboarding-height" name="height" type="number" min="100" max="250" step="0.1" value="${e(profile.height)}" placeholder="Ej. 170"></div>
        <div class="field"><label for="onboarding-weight">Peso (kg) <span class="optional-mark">opcional</span></label><input id="onboarding-weight" name="weight" type="number" min="20" max="350" step="0.1" value="${e(profile.weight)}" placeholder="Ej. 68.5"></div>
        <div class="field full"><label for="onboarding-level">¿Cómo describirías tu experiencia física?</label><select id="onboarding-level" name="level">${["Principiante", "Intermedio", "Avanzado"].map(level => `<option ${level === profile.level ? "selected" : ""}>${level}</option>`).join("")}</select><small>Elige “Principiante” si estás empezando o volviendo después de una pausa.</small></div>
      </div></section>
      <section class="onboarding-panel" data-onboarding-step="1" ${onboardingStep === 1 ? "" : "hidden"}><div class="step-heading"><span class="eyebrow">02 / TUS DEPORTES</span><h2>¿Qué deportes practicas?</h2><p>Puedes elegir varios. Selecciona también cuál quieres priorizar para personalizar las primeras rutinas.</p></div>
        <fieldset class="field sport-fieldset"><legend>Marca todos los que practicas <span class="required-mark">*</span></legend><div class="sports-choice-grid">${SPORTS.map(sport => `<label class="sport-choice"><input type="checkbox" name="sports" value="${sport.id}" ${selectedSports.includes(sport.id) ? "checked" : ""}><span class="sport-choice-icon">${sport.id === "correr" ? "↗" : sport.id === "natacion" ? "≈" : sport.id === "ciclismo" ? "◉" : sport.id === "baile" ? "♪" : sport.id === "artes-marciales" ? "✦" : "◎"}</span><span><strong>${e(sport.name)}</strong><small>${e(sport.description)}</small></span><i class="choice-check">✓</i></label>`).join("")}</div><small>Puedes cambiar la selección después en “Mi perfil”. Para varios deportes, prioriza uno por rutina.</small></fieldset>
        <div class="form-grid sport-config"><div class="field"><label for="onboarding-primary-sport">Deporte que quieres priorizar <span class="required-mark">*</span></label><select name="mainSport" id="onboarding-primary-sport" required><option value="">Elige tu deporte principal</option>${sportOptions}</select></div><div class="field"><label for="onboarding-sport-level">Experiencia en ese deporte</label><select id="onboarding-sport-level" name="sportExperience">${["Principiante", "Intermedio", "Avanzado"].map(level => `<option ${level === profile.sportExperience ? "selected" : ""}>${level}</option>`).join("")}</select></div><div class="field full" id="other-sport-field" ${profile.mainSport === "otro" ? "" : "hidden"}><label for="onboarding-other-sport">¿Qué otro deporte practicas?</label><input id="onboarding-other-sport" name="otherSport" maxlength="60" value="${e(profile.otherSport)}" placeholder="Ej. escalada, hockey, patinaje"></div></div>
        <div class="sport-preview" id="sport-preview">${sportPreview(profile.mainSport)}</div>
      </section>
      <section class="onboarding-panel" data-onboarding-step="2" ${onboardingStep === 2 ? "" : "hidden"}><div class="step-heading"><span class="eyebrow">03 / CÓMO ENTRENARÁS</span><h2>Hagamos un plan realista.</h2><p>Tomamos en cuenta el tiempo, el lugar y el equipo que tienes. Siempre puedes modificarlo.</p></div><div class="form-grid">
        <div class="field"><label for="onboarding-goal">¿Qué te gustaría mejorar?</label><select id="onboarding-goal" name="goal">${["Mejorar mi condición física", "Preparación física para mi deporte", "Ganar fuerza", "Mejorar resistencia", "Movilidad y bienestar"].map(goal => `<option ${goal === (profile.goal || "Preparación física para mi deporte") ? "selected" : ""}>${e(goal)}</option>`).join("")}</select></div>
        <div class="field"><label for="onboarding-days">¿Cuántos días por semana?</label><select id="onboarding-days" name="weeklySessions">${[1, 2, 3, 4, 5, 6, 7].map(count => `<option value="${count}" ${count === state.goals.weeklySessions ? "selected" : ""}>${count} ${count === 1 ? "día" : "días"}</option>`).join("")}</select><small>Cuenta las sesiones complementarias que quieres planificar aquí.</small></div>
        <div class="field"><label for="onboarding-practice-days">¿Cuántos días practicas ese deporte?</label><select id="onboarding-practice-days" name="practiceDays">${[["0", "Aún no practico"], ["1", "1 día"], ["2", "2 días"], ["3", "3 días"], ["4", "4 días"], ["5", "5 días"], ["6", "6 días"], ["7", "Todos los días"]].map(([value, label]) => `<option value="${value}" ${Number(value) === Number(profile.practiceDays) ? "selected" : ""}>${label}</option>`).join("")}</select><small>Frecuencia habitual, aparte de las sesiones complementarias.</small></div>
        <div class="field"><label for="onboarding-practice-minutes">Duración aproximada de cada práctica</label><select id="onboarding-practice-minutes" name="practiceMinutes">${[["0", "No lo sé / no practico"], ["30", "Hasta 30 minutos"], ["60", "30–60 minutos"], ["90", "60–90 minutos"], ["120", "Más de 90 minutos"]].map(([value, label]) => `<option value="${value}" ${Number(value) === Number(profile.practiceMinutes) ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="field"><label for="onboarding-minutes">Tiempo para cada sesión complementaria</label><select id="onboarding-minutes" name="sessionMinutes">${[15, 20, 30, 45, 60].map(minutes => `<option value="${minutes}" ${minutes === Number(profile.sessionMinutes) ? "selected" : ""}>${minutes} minutos</option>`).join("")}</select></div>
        <div class="field"><label for="onboarding-location">¿Dónde entrenarás?</label><select id="onboarding-location" name="trainingLocation">${["Casa", "Gimnasio", "Parque o exterior", "Cancha o club", "Piscina", "Otro lugar"].map(location => `<option ${location === profile.trainingLocation ? "selected" : ""}>${location}</option>`).join("")}</select></div>
        <fieldset class="field full equipment-field"><legend>¿Qué equipo tienes disponible?</legend><div class="choice-row">${["Sin equipo", "Mancuernas", "Bandas"].map(item => `<label class="choice-chip"><input type="checkbox" name="equipment" value="${item}" ${(profile.equipment || ["Sin equipo"]).includes(item) ? "checked" : ""}><span>${item}</span></label>`).join("")}</div></fieldset>
        <div class="field full"><label for="onboarding-limitations">Movimientos que prefieres evitar <span class="optional-mark">opcional</span></label><textarea id="onboarding-limitations" name="limitations" maxlength="180" rows="2" placeholder="Por ejemplo: prefiero evitar ejercicios con saltos. No escribas información médica personal.">${e(profile.limitations)}</textarea><small>Esto se guarda solo en tu navegador. No es una evaluación médica ni ajusta automáticamente cargas.</small></div>
      </div></section>
      <div class="onboarding-error" id="onboarding-error" role="alert" hidden></div>
      <div class="onboarding-actions"><button class="button button-outline" type="button" data-action="back-onboarding" ${onboardingStep === 0 ? "hidden" : ""}>← Atrás</button><span class="onboarding-step-count">Paso ${onboardingStep + 1} de 3</span>${onboardingStep < 2 ? '<button class="button button-primary" type="button" data-action="next-onboarding">Continuar →</button>' : '<button class="button button-primary" type="submit">Guardar perfil y ver mi plan <span>→</span></button>'}</div>
    </form>
    <p class="onboarding-privacy">Los campos de peso, estatura y edad son opcionales. Entrenamiento complementario, no sustituto de práctica deportiva, entrenador ni atención sanitaria. La cuenta es local y no es segura para producción.</p>
    </section><div class="onboarding-side"><div class="onboarding-side-art"><span>ONNY<br>COACH</span><div class="onboarding-mascot"><span class="mascot-whistle">◆</span><span class="mascot-watch">◷</span><span class="mascot-face">◡</span></div><div class="onboarding-orbit"></div></div><span class="eyebrow">UN PLAN QUE EMPIEZA CONTIGO</span><h2>No hay dos atletas iguales.</h2><p>Tu deporte, tu experiencia y tu disponibilidad determinan por dónde empezar. Te explicaremos qué aporta cada ejercicio y sus límites.</p><div class="onboarding-side-note"><strong>Orientación honesta</strong><small>Los ejercicios son complementarios y locales; no se generan diagnósticos ni promesas de rendimiento.</small></div></div></main>`;
}

function sportPreview(sportId) {
  const sport = SPORTS.find(item => item.id === sportId);
  if (!sport) return '<span class="preview-icon">◎</span><p>Elige un deporte para ver en qué se enfocará la recomendación.</p>';
  return `<span class="preview-icon">◎</span><div><strong>Enfoque para ${e(sport.name)}</strong><p>${e(sport.focus)}</p></div>`;
}

function setOnboardingStep(step) {
  onboardingStep = Math.max(0, Math.min(2, step));
  document.querySelectorAll("[data-onboarding-step]").forEach(panel => {
    panel.hidden = Number(panel.dataset.onboardingStep) !== onboardingStep;
  });
  document.querySelectorAll(".onboarding-step").forEach((panel, index) => {
    panel.classList.toggle("current", index === onboardingStep);
    panel.classList.toggle("done", index < onboardingStep);
    panel.querySelector("span").textContent = index < onboardingStep ? "✓" : `0${index + 1}`;
  });
  document.querySelector(".onboarding-progress .progress-track span").style.width = `${Math.round((onboardingStep + 1) / 3 * 100)}%`;
  document.querySelector(".onboarding-step-count").textContent = `Paso ${onboardingStep + 1} de 3`;
  document.querySelector('[data-action="back-onboarding"]').hidden = onboardingStep === 0;
  document.querySelector(".onboarding-actions [data-action=\"next-onboarding\"]")?.remove();
  document.querySelector(".onboarding-actions [type=\"submit\"]")?.remove();
  const nextButton = document.createElement("button");
  nextButton.className = "button button-primary";
  nextButton.type = onboardingStep === 2 ? "submit" : "button";
  nextButton.dataset.action = onboardingStep === 2 ? "" : "next-onboarding";
  nextButton.innerHTML = onboardingStep === 2 ? "Guardar perfil y ver mi plan <span>→</span>" : "Continuar →";
  document.querySelector(".onboarding-actions").append(nextButton);
  const error = document.querySelector("#onboarding-error");
  error.hidden = true;
  error.textContent = "";
  document.querySelector(".onboarding-card").scrollIntoView({ behavior: "smooth", block: "start" });
}

function validateOnboardingStep(step) {
  const panel = document.querySelector(`[data-onboarding-step="${step}"]`);
  const invalidField = [...panel.querySelectorAll("input, select, textarea")].find(input => !input.checkValidity());
  if (invalidField) {
    if (panel.hidden) showOnboardingError(`Revisa el paso ${step + 1}: ${invalidField.labels?.[0]?.textContent?.trim() || "hay un dato obligatorio pendiente"}.`);
    else invalidField.reportValidity();
    return false;
  }
  if (step === 1) {
    const sports = new FormData(document.querySelector("#onboarding-form")).getAll("sports");
    const primarySport = document.querySelector("#onboarding-primary-sport").value;
    if (!sports.length) {
      showOnboardingError("Selecciona al menos un deporte para adaptar tu plan.");
      return false;
    }
    if (!sports.includes(primarySport)) {
      showOnboardingError("Incluye también en la selección el deporte que quieres priorizar.");
      return false;
    }
  }
  return true;
}

function showOnboardingError(message) {
  const error = document.querySelector("#onboarding-error");
  error.textContent = message;
  error.hidden = false;
  error.focus();
}

function updateSportSelection(form, changedInput = null) {
  const selected = new FormData(form).getAll("sports");
  const mainSport = form.querySelector("#onboarding-primary-sport");
  if (mainSport) {
    if (changedInput?.name === "sports" && changedInput.checked && !mainSport.value) mainSport.value = changedInput.value;
    if (changedInput?.name === "sports" && !changedInput.checked && mainSport.value === changedInput.value) mainSport.value = selected[0] || "";
    if (changedInput?.name === "mainSport" && mainSport.value && !selected.includes(mainSport.value)) {
      const checkbox = form.querySelector(`input[name="sports"][value="${CSS.escape(mainSport.value)}"]`);
      if (checkbox) checkbox.checked = true;
    }
  }
  const otherField = document.querySelector("#other-sport-field");
  if (otherField) otherField.hidden = (mainSport?.value || "") !== "otro";
  const preview = document.querySelector("#sport-preview");
  if (preview) preview.innerHTML = sportPreview(mainSport?.value || "");
  const routineSport = document.querySelector("#routine-sport");
  if (routineSport) {
    const routinePreview = document.querySelector(".routine-sport-preview");
    if (routinePreview) routinePreview.innerHTML = sportPreview(routineSport.value);
    const button = document.querySelector("#routine-form button[type=submit]");
    const label = SPORTS.find(sport => sport.id === routineSport.value)?.name || "mi deporte";
    if (button) button.innerHTML = `Generar rutina para ${e(label)} <span>✦</span>`;
  }
}

const empty = (icon, title, copy, actionLabel = "", action = "") => `<div class="empty-state"><span class="empty-icon">${icon}</span><h3>${e(title)}</h3><p>${e(copy)}</p>${actionLabel ? `<button class="button button-secondary" data-view="${e(action)}">${e(actionLabel)} <span aria-hidden="true">→</span></button>` : ""}</div>`;
const pageHeading = (eyebrow, title, description, action = "") => `<div class="page-heading"><div><span class="eyebrow">${e(eyebrow)}</span><h1>${title}</h1><p>${e(description)}</p></div>${action}</div>`;
const statCard = (label, value, note, icon, color = "blue") => `<article class="stat-card"><div class="stat-top"><span>${e(label)}</span><span class="stat-icon ${color}">${icon}</span></div><strong>${e(value)}</strong><small>${e(note)}</small></article>`;

function getWeeklyCount() {
  const start = dateKey(getWeekDates()[0]);
  return state.workouts.filter(item => item.date >= start && item.date <= today()).length;
}

function dashboardView() {
  const weekly = getWeeklyCount();
  const totalMinutes = state.workouts.reduce((sum, item) => sum + (Number(item.duration) || 0), 0);
  const latest = [...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const weekDays = getWeekDates();
  const weight = state.profile.weight ? `${state.profile.weight} kg` : "—";
  const progress = state.goals.weeklySessions ? Math.min(100, Math.round(weekly / state.goals.weeklySessions * 100)) : 0;
  const primarySport = SPORTS.find(sport => sport.id === state.profile.mainSport);
  return `${pageHeading("TU ESPACIO, TU RITMO", `Hola${state.profile.name ? `, ${e(state.profile.name.split(/\s+/)[0])}` : ""} <span class="heading-wave">✦</span>`, primarySport ? `Plan complementario para ${primarySport.name}. Cada sesión es una inversión en ti.` : "Cada sesión es una inversión en ti.", `<div class="heading-actions"><a class="button button-secondary" href="#routines" data-view="routines">Ajustar mi plan</a><button class="button button-primary" data-action="start-workout">＋ Empezar mi plan</button></div>`)}
    <section class="stats-grid">${statCard("Sesiones esta semana", String(weekly), `Objetivo: ${state.goals.weeklySessions} sesiones`, "↗")}${statCard("Tiempo entrenado", `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`, "Tiempo registrado", "◷", "violet")}${statCard("Sesiones totales", String(state.workouts.length), "Desde que empezaste", "◈", "green")}${statCard("Peso actual", weight, state.weightLog.length ? "Último registro" : "Añade un registro en Progreso", "⌁", "orange")}</section>
    <section class="dashboard-grid"><article class="panel week-panel"><div class="panel-heading"><div><span class="eyebrow">TU CONSTANCIA</span><h2>Esta semana</h2></div><a href="#calendar" data-view="calendar" class="text-link">Ver calendario →</a></div><div class="week-days">${weekDays.map(date => { const key = dateKey(date); const isDone = state.workouts.some(item => item.date === key); const isToday = key === today(); return `<div class="week-day ${isToday ? "is-today" : ""}"><span>${new Intl.DateTimeFormat("es", { weekday: "short" }).format(date).replace(".", "")}</span><b class="${isDone ? "day-done" : ""}">${isDone ? "✓" : date.getDate()}</b></div>`; }).join("")}</div><div class="goal-progress"><div><span>Objetivo semanal</span><strong>${weekly} / ${state.goals.weeklySessions} sesiones</strong></div><div class="progress-track"><span style="width:${progress}%"></span></div></div></article>
    <article class="panel focus-panel"><div class="panel-heading"><div><span class="eyebrow">TU ENFOQUE DEPORTIVO</span><h2>${e(primarySport?.name || "Actividad general")}</h2></div><span class="target-icon">◎</span></div><p class="focus-goal">${e(state.profile.goal)}</p><p class="muted">${state.profile.sportExperience || state.profile.level} · ${state.profile.practiceDays || 0} días de práctica + ${state.goals.weeklySessions} sesiones complementarias por semana</p><p class="focus-rationale">${e(primarySport?.focus || "Acondicionamiento general complementario.")}</p><a class="text-link" href="#profile" data-view="profile">Editar perfil y deportes →</a></article></section>
    <section class="lower-grid"><article class="panel recent-panel"><div class="panel-heading"><div><span class="eyebrow">TU HISTORIAL</span><h2>Actividad reciente</h2></div><a href="#progress" data-view="progress" class="text-link">Ver todo →</a></div>${latest.length ? `<div class="activity-list">${latest.map(item => `<div class="activity-row"><span class="activity-symbol">✓</span><div><strong>${e(item.name || "Entrenamiento")}</strong><small>${formatDate(item.date)} · ${Number(item.duration) || 0} min</small></div><span class="activity-tag">${e(item.goal || "Completado")}</span></div>`).join("")}</div>` : empty("◷", "Tu historia empieza aquí", "Completa una sesión para ver tu actividad reciente.", "Crear una rutina", "routines")}</article>
    <article class="panel progress-panel"><div class="panel-heading"><div><span class="eyebrow">EN PERSPECTIVA</span><h2>Tu actividad</h2></div><span class="chart-legend"><i></i> Sesiones</span></div>${state.workouts.length ? `<canvas class="mini-chart" data-chart="activity" aria-label="Gráfico de sesiones por semana"></canvas>` : empty("↗", "Aún no hay datos", "Tu gráfico aparecerá al registrar entrenamientos.")}</article></section>
    <div class="demo-strip"><span>✦</span><p>¿Preparando una presentación? Carga ejemplos <strong>claramente marcados como demostración</strong>.</p><button class="button button-quiet" data-action="load-demo">Cargar datos demo</button></div>`;
}

function routinesView() {
  const selectedSports = (state.profile.sports || []).filter(id => SPORTS.some(sport => sport.id === id));
  if (!selectedSports.length) selectedSports.push(SPORTS.some(sport => sport.id === state.profile.mainSport) ? state.profile.mainSport : "multideporte");
  const currentSport = selectedSports.includes(state.profile.mainSport) ? state.profile.mainSport : selectedSports[0];
  const routineCards = state.routines.map(routine => {
    const sport = SPORTS.find(item => item.id === routine.sportId);
    return `<article class="routine-card"><div class="routine-cover"><span>ONNY / PLAN · ${e(sport?.name || "DEPORTE")}</span><span class="routine-badge">${e(routine.goal)}</span><span class="routine-watermark">0${routine.exerciseIds.length}</span></div><div class="routine-card-body"><h3>${e(routine.name)}</h3><p>${routine.exerciseIds.length} ejercicios · ${Number(routine.minutes) || "—"} min · ${e(routine.level || "Adaptada")}</p><div class="routine-focus"><strong>¿Por qué esta rutina?</strong><span>${e(sport?.focus || "Acondicionamiento general complementario.")}</span></div><div class="routine-actions"><button class="button button-primary button-small" data-action="use-routine" data-id="${e(routine.id)}">Empezar sesión</button><button class="icon-button danger-icon" data-action="delete-routine" data-id="${e(routine.id)}" aria-label="Eliminar ${e(routine.name)}">×</button></div></div></article>`;
  }).join("");
  return `${pageHeading("PLANIFICA TU MOVIMIENTO", "Rutinas <em>a tu medida.</em>", "Crea un plan con lo que tienes y el tiempo del que dispones.")}
    <div class="routines-layout"><section class="panel routine-builder"><div class="panel-heading"><div><span class="eyebrow">GENERADOR LOCAL</span><h2>Diseña tu sesión</h2></div><span class="panel-spark">✳</span></div><form id="routine-form" class="form-grid">
      <div class="field full"><label for="routine-sport">Deporte que quieres priorizar</label><select id="routine-sport" name="sportId">${selectedSports.map(id => SPORTS.find(sport => sport.id === id)).filter(Boolean).map(sport => `<option value="${sport.id}" ${sport.id === currentSport ? "selected" : ""}>${e(sport.name)}</option>`).join("")}</select></div>
      <div class="sport-preview routine-sport-preview">${sportPreview(currentSport)}</div>
      <div class="field full"><label for="routine-goal">Objetivo de la sesión</label><select id="routine-goal" name="goal">${["Preparación física para mi deporte", "Mejorar mi condición física", "Ganar fuerza", "Mejorar resistencia", "Movilidad y bienestar"].map(goal => `<option ${goal === (state.profile.goal || "Preparación física para mi deporte") ? "selected" : ""}>${e(goal)}</option>`).join("")}</select></div>
      <div class="field"><label for="routine-level">Experiencia</label><select id="routine-level" name="level">${["Principiante", "Intermedio", "Avanzado"].map(level => `<option ${level === state.profile.level ? "selected" : ""}>${level}</option>`).join("")}</select></div>
      <div class="field"><label for="routine-time">Tiempo disponible</label><select id="routine-time" name="minutes">${[15, 20, 30, 45, 60].map(minutes => `<option value="${minutes}" ${minutes === Number(state.profile.sessionMinutes) ? "selected" : ""}>${minutes} minutos</option>`).join("")}</select></div>
      <fieldset class="field full"><legend>Equipamiento disponible</legend><div class="choice-row">${["Sin equipo", "Mancuernas", "Bandas"].map(item => `<label class="choice-chip"><input type="checkbox" name="equipment" value="${item}" ${(state.profile.equipment || ["Sin equipo"]).includes(item) ? "checked" : ""}><span>${item}</span></label>`).join("")}</div></fieldset>
      ${state.profile.limitations ? `<div class="profile-limit-note full"><strong>Tu preferencia</strong><span>${e(state.profile.limitations)}</span><small>Revisa las instrucciones y omite cualquier movimiento que no te resulte adecuado.</small></div>` : ""}
      <button class="button button-primary full" type="submit">Generar rutina para ${e(SPORTS.find(sport => sport.id === currentSport)?.name || "mi deporte")} <span>✦</span></button><p class="form-hint full">Complemento físico general: no sustituye tu práctica técnica, entrenador ni orientación sanitaria. Ajusta intensidad y detente ante el dolor.</p>
    </form></section><aside class="routine-aside"><div class="routine-aside-art"><span class="art-ring"></span><span class="art-kicker">MOVE<br>YOUR<br>WAY</span><div class="art-dumbbell">●━━━━●</div></div><h3>Entrena a tu manera.</h3><p>Las sugerencias se crean en tu navegador a partir de los ejercicios de la biblioteca, tu tiempo y el equipo que tienes.</p><div class="aside-stat"><span>12</span><small>ejercicios disponibles</small><span class="aside-arrow">↗</span></div></aside></div>
    <div class="sport-explainer-strip"><strong>¿Cómo se adapta?</strong><span>Usamos tu deporte principal para elegir una base de fuerza, control o movilidad. Cada ejercicio incluye su propósito, los pasos para hacerlo y lo que no reemplaza.</span></div>
    <section class="saved-routines"><div class="section-title"><div><span class="eyebrow">TUS PLANES</span><h2>Rutinas guardadas</h2></div></div>${routineCards ? `<div class="routine-grid">${routineCards}</div>` : empty("◈", "Todavía no tienes rutinas", "Usa el generador para crear un plan y guardarlo en este navegador.")}</section>`;
}

function exercisesView() {
  const categories = ["Todos", ...new Set(EXERCISES.map(item => item.category))];
  const filtered = EXERCISES.filter(item => (exerciseFilter === "Todos" || item.category === exerciseFilter) && `${item.name} ${item.muscles} ${item.equipment.join(" ")}`.toLowerCase().includes(searchQuery.toLowerCase()));
  return `${pageHeading("CONOCE TU MOVIMIENTO", "Biblioteca de <em>ejercicios.</em>", "Instrucciones claras, adaptaciones y equipo necesario.")}
    <section class="panel exercise-library"><div class="library-tools"><label class="search-field"><span aria-hidden="true">⌕</span><input id="exercise-search" type="search" value="${e(searchQuery)}" placeholder="Buscar ejercicio o músculo…" aria-label="Buscar ejercicios"></label><div class="filter-row" role="group" aria-label="Filtrar por categoría">${categories.map(item => `<button class="filter-chip ${exerciseFilter === item ? "selected" : ""}" data-filter="${e(item)}" aria-pressed="${exerciseFilter === item}">${e(item)}</button>`).join("")}</div></div>
    <div class="exercise-grid">${filtered.map(item => `<article class="exercise-card"><div class="exercise-visual ${e(item.category.toLowerCase())}"><span class="exercise-number">${String(EXERCISES.indexOf(item) + 1).padStart(2, "0")}</span><span class="exercise-figure">${item.category === "Cardio" ? "↗" : item.category === "Core" ? "◎" : "✳"}</span><span class="category-pill">${e(item.category)}</span></div><div class="exercise-body"><div class="exercise-title"><h3>${e(item.name)}</h3><span class="level-pill">${e(item.level)}</span></div><p>${e(item.muscles)}</p><details class="exercise-details" open><summary>¿Para qué sirve y cómo se hace?</summary><div class="exercise-explanation"><strong>Qué trabaja</strong><p>${e(item.benefit || "Aporta movimiento general; adapta el ejercicio a tu experiencia.")}</p>${state.profile.mainSport ? `<strong>Relación con ${e(SPORTS.find(sport => sport.id === state.profile.mainSport)?.name || "tu deporte")}</strong><p>${e(exerciseSportBenefit(item, state.profile.mainSport))}</p>` : ""}<strong>Cómo hacerlo</strong><p>${e(item.instructions)}</p></div><div class="exercise-meta"><span>${item.sets} series</span><span>${e(item.reps)} rep.</span><span>${item.rest} s descanso</span><span>${e(item.equipment.join(", "))}</span></div><p class="exercise-limits">Es un ejercicio complementario. No enseña la técnica específica de tu deporte.</p></details><button class="button button-outline button-small" data-action="quick-exercise" data-id="${e(item.id)}">Entrenar este ejercicio</button></div></article>`).join("") || empty("⌕", "No encontramos ejercicios", "Prueba con otro término o categoría.")}</div></section>`;
}

function routineForSession() {
  const { mainSport, goal, sportExperience, sessionMinutes, equipment } = state.profile;
  const matchesProfile = item => item.sportId === mainSport &&
    item.goal === goal &&
    item.level === sportExperience &&
    Number(item.minutes) === Number(sessionMinutes) &&
    Array.isArray(item.equipment) &&
    item.equipment.length === equipment.length &&
    item.equipment.every(tool => equipment.includes(tool));
  if (state.currentRoutine && matchesProfile(state.currentRoutine)) {
    routineWarningMessage = "";
    return state.currentRoutine;
  }
  const candidate = state.routines.find(matchesProfile);
  if (candidate) {
    routineWarningMessage = "";
    return candidate;
  }
  const sportId = mainSport || "multideporte";
  try {
    const routine = buildRoutine({ sportId, goal, level: sportExperience, minutes: sessionMinutes, equipment });
    routineWarningMessage = "";
    return routine;
  } catch (error) {
    if (!(error instanceof Error)) throw error;
    routineWarningMessage = error.message;
    const sport = SPORTS.find(item => item.id === sportId) || SPORTS.find(item => item.id === "multideporte");
    return { id: "quick-start", name: `Sesión complementaria · ${sport.name}`, sportId: sport.id, goal, minutes: sessionMinutes || 20, exerciseIds: sport.exerciseIds.slice(0, 4) };
  }
}

function workoutView() {
  const routine = routineForSession();
  const currentId = session?.exerciseIds[session.index] || routine.exerciseIds[0];
  const current = EXERCISE_BY_ID.get(currentId) || EXERCISES[0];
  const sportId = session?.sportId || routine.sportId || state.profile.mainSport || "multideporte";
  const sportInfo = SPORTS.find(item => item.id === sportId);
  const isRunningEndurance = sportId === "correr" && String(routine.goal || "").toLowerCase().includes("resistencia");
  const sport = isRunningEndurance && sportInfo
    ? { ...sportInfo, focus: "Caminata a ritmo conversacional como estímulo aeróbico suave. Ajusta la carrera según tu práctica habitual; esta guía no prescribe su volumen." }
    : sportInfo;
  const isActive = Boolean(session);
  const elapsed = isActive ? Math.floor((Date.now() - session.startedAt - session.pausedMs - (session.pausedAt ? Date.now() - session.pausedAt : 0)) / 1000) : 0;
  return `${pageHeading("PRESENCIA EN CADA REPETICIÓN", "Modo <em>entrenamiento.</em>", "Muévete con control. Registra cada sesión al finalizar.")}
  ${isActive ? `<div class="workout-layout"><section class="panel workout-main"><div class="workout-status"><span class="live-pill"><i></i> ${session.pausedAt ? "EN PAUSA" : "SESIÓN EN CURSO"}</span><span class="workout-count">${session.index + 1} / ${session.exerciseIds.length} ejercicios · ${e(sport?.name || "Acondicionamiento")}</span></div><div class="workout-exercise-art ${e(current.category.toLowerCase())}"><span class="workout-art-index">${String(session.index + 1).padStart(2, "0")}</span><span>${current.category === "Cardio" ? "↗" : "✳"}</span><small>${e(current.category.toUpperCase())}</small></div><div class="workout-exercise-info"><div><span class="eyebrow">EJERCICIO ACTUAL</span><h2>${e(current.name)}</h2><p>${e(current.muscles)}</p></div><div class="workout-set-info"><strong>${current.sets}</strong><span>series</span><strong>${e(current.reps)}</strong><span>repeticiones</span></div></div><div class="workout-explanation"><strong>¿Qué aporta a ${e(sport?.name || "tu condición física")}?</strong><p>${e(exerciseSportBenefit(current, sportId))}</p><strong>Cómo hacerlo</strong><p>${e(current.instructions)}</p><small>${e(sport?.focus || "Complementa tu práctica; no sustituye asesoramiento individual.")}</small></div><div class="workout-progress"><span style="width:${Math.round((session.index + 1) / session.exerciseIds.length * 100)}%"></span></div><div class="workout-controls"><button class="button button-outline" data-action="pause-workout">${session.pausedAt ? "▶ Reanudar" : "Ⅱ Pausar"}</button><button class="button button-secondary" data-action="rest-timer">◷ ${session.restLeft ? `Descanso ${formatDuration(session.restLeft)}` : "Iniciar descanso"}</button><button class="button button-primary" data-action="next-exercise">${session.index === session.exerciseIds.length - 1 ? "Finalizar sesión" : "Siguiente →"}</button></div></section><aside class="panel timer-panel"><span class="eyebrow">TIEMPO DE SESIÓN</span><div class="timer-ring"><strong id="elapsed-timer">${formatDuration(elapsed)}</strong><small>min : seg</small></div><p>Escucha tu cuerpo. Si necesitas parar, hazlo.</p><div class="session-plan"><strong>Tu sesión</strong>${session.exerciseIds.map((id, i) => { const exercise = EXERCISE_BY_ID.get(id); return exercise ? `<div class="plan-row ${i === session.index ? "current" : i < session.index ? "done" : ""}"><span>${i < session.index ? "✓" : String(i + 1).padStart(2, "0")}</span>${e(exercise.name)}</div>` : ""; }).join("")}</div><button class="button button-danger full-width" data-action="end-workout">Terminar sesión</button></aside></div>` : `<section class="panel workout-start"><div class="start-illustration"><span class="start-circle">▶</span><span class="start-lines"></span></div><div class="workout-start-copy"><span class="eyebrow">LISTA PARA EMPEZAR</span><h2>${e(routine.name)}</h2><p>${routine.exerciseIds.length} ejercicios · Aproximadamente ${Number(routine.minutes) || 20} minutos · ${e(sport?.name || "Tu deporte")}</p><div class="workout-explanation"><strong>Propósito del plan</strong><p>${e(sport?.focus || "Acondicionamiento general complementario.")}</p></div><div class="start-exercise-chips">${routine.exerciseIds.map(id => EXERCISE_BY_ID.get(id)).filter(Boolean).map(item => `<span>${e(item.name)}</span>`).join("")}</div><div class="start-actions"><button class="button button-primary" data-action="begin-workout">Comenzar sesión <span>→</span></button><a href="#routines" class="text-link" data-view="routines">Elegir otra rutina</a></div></div></section>  <div class="notice-card"><span>ⓘ</span><p>${routineWarningMessage ? `No se pudo adaptar una rutina a todos tus criterios: ${e(routineWarningMessage)} Se muestra una sesión complementaria general para ${e(sport?.name || "tu deporte")}. ` : ""}La sesión se cronometra en este dispositivo. El descanso es opcional; pausa el entrenamiento cuando lo necesites. La sesión solo se registra cuando la finalizas.</p></div>`}`;
}

function calendarView() {
  const referenceDate = new Date();
  referenceDate.setDate(referenceDate.getDate() + calendarWeekOffset * 7);
  const dates = getWeekDates(referenceDate);
  const done = state.workouts.map(item => item.date);
  const sessions = state.workouts.filter(item => item.date >= dateKey(dates[0]) && item.date <= dateKey(dates[6]));
  const weekTitle = calendarWeekOffset === 0 ? "SEMANA ACTUAL" : calendarWeekOffset < 0 ? `${Math.abs(calendarWeekOffset)} SEMANA${calendarWeekOffset < -1 ? "S" : ""} ANTERIOR${calendarWeekOffset < -1 ? "ES" : ""}` : `SEMANA PRÓXIMA`;
  const weekNavigation = `<button class="button button-secondary button-small" data-action="prev-week">← Anterior</button>${calendarWeekOffset < 0 ? '<button class="button button-secondary button-small" data-action="next-week">Próxima →</button>' : ""}`;
  const weekSummary = calendarWeekOffset === 0 ? "ESTA SEMANA" : calendarWeekOffset < 0 ? "SEMANA ANTERIOR" : "SEMANA PRÓXIMA";
  return `${pageHeading("RITMO SOSTENIBLE", "Tu semana <em>en movimiento.</em>", "Cada día cuenta, también el de descanso.", weekNavigation)}
  <section class="panel calendar-panel"><div class="calendar-heading"><div><span class="eyebrow">${weekTitle}</span><h2>${new Intl.DateTimeFormat("es", { day: "numeric", month: "long" }).format(dates[0])} — ${new Intl.DateTimeFormat("es", { day: "numeric", month: "long" }).format(dates[6])}</h2></div><span class="calendar-total">${sessions.length}<small> sesiones</small></span></div><div class="calendar-week">${dates.map(date => { const key = dateKey(date); const complete = done.includes(key); const isToday = key === today(); return `<article class="calendar-day ${isToday ? "is-today" : ""} ${complete ? "complete" : ""}"><span class="calendar-day-name">${new Intl.DateTimeFormat("es", { weekday: "long" }).format(date)}</span><strong>${date.getDate()}</strong><span class="calendar-day-dot">${complete ? "✓" : isToday ? "HOY" : "·"}</span>${complete ? `<small>${state.workouts.filter(item => item.date === key).length} sesión${state.workouts.filter(item => item.date === key).length > 1 ? "es" : ""}</small>` : '<small>—</small>'}</article>`; }).join("")}</div><div class="calendar-legend"><span><i class="legend-complete">✓</i> Día con entrenamiento registrado</span><span><i class="legend-today"></i> Hoy</span></div></section>
  <section class="panel calendar-summary"><div class="panel-heading"><div><span class="eyebrow">${weekSummary}</span><h2>Sesiones registradas</h2></div><a href="#workout" data-view="workout" class="text-link">Entrenar ahora →</a></div>${sessions.length ? `<div class="activity-list">${sessions.map(item => `<div class="activity-row"><span class="activity-symbol">✓</span><div><strong>${e(item.name || "Entrenamiento")}</strong><small>${formatDate(item.date)} · ${Number(item.duration) || 0} min</small></div><span class="activity-tag">${e(item.goal || "Completado")}</span></div>`).join("")}</div>` : empty("▦", "Semana por escribir", "Al completar una sesión, aparecerá aquí.")}</section>
  <div class="notice-card"><span>✦</span><p>El calendario muestra sesiones que finalizaste y registraste en esta aplicación. No se sincroniza con calendarios externos.</p></div>`;
}

function progressView() {
  const weights = [...state.weightLog].sort((a, b) => a.date.localeCompare(b.date));
  const latest = weights.at(-1);
  const previous = weights.at(-2);
  const delta = latest && previous ? (Number(latest.weight) - Number(previous.weight)).toFixed(1) : null;
  return `${pageHeading("LOS CAMBIOS SE CONSTRUYEN", "Tu progreso <em>real.</em>", "Registra tus datos y observa tu evolución, sin comparaciones.", `<a class="button button-secondary" href="#profile" data-view="profile">Editar objetivos →</a>`)}
  <section class="stats-grid progress-stats">${statCard("Sesiones registradas", String(state.workouts.length), "Todas tus sesiones completadas", "◈")}${statCard("Tiempo total", `${state.workouts.reduce((sum, item) => sum + (Number(item.duration) || 0), 0)} min`, "Tiempo acumulado", "◷", "violet")}${statCard("Peso más reciente", latest ? `${latest.weight} kg` : "—", latest ? formatDate(latest.date) : "Añade tu primer registro", "⌁", "green")}${statCard("Cambio entre registros", delta === null ? "—" : `${Number(delta) > 0 ? "+" : ""}${delta} kg`, "Solo descriptivo, no es una meta médica", "↗", "orange")}</section>
  <section class="charts-grid"><article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">TENDENCIA PERSONAL</span><h2>Evolución del peso</h2></div><span class="chart-legend"><i class="weight-dot"></i> kg</span></div>${weights.length > 1 ? `<canvas data-chart="weight" aria-label="Gráfico de evolución del peso"></canvas>` : empty("⌁", weights.length ? "Añade otro registro" : "Sin registros todavía", weights.length ? "Un segundo registro permitirá ver una tendencia." : "El peso es opcional. Registra solo si te resulta útil.")}</article><article class="panel chart-panel"><div class="panel-heading"><div><span class="eyebrow">CONSTANCIA SEMANAL</span><h2>Sesiones por semana</h2></div></div>${state.workouts.length ? `<canvas data-chart="activity" aria-label="Gráfico de sesiones por semana"></canvas>` : empty("↗", "Sin sesiones aún", "El gráfico aparecerá después de completar un entrenamiento.")}</article></section>
  <section class="panel goal-tracking"><div class="panel-heading"><div><span class="eyebrow">OBJETIVOS PERSONALES</span><h2>Tu seguimiento</h2></div></div><div class="tracking-grid"><div><span>Sesiones esta semana</span><strong>${getWeeklyCount()} / ${state.goals.weeklySessions}</strong><div class="progress-track"><span style="width:${Math.min(100, Math.round(getWeeklyCount() / state.goals.weeklySessions * 100))}%"></span></div></div><div><span>Objetivo de peso</span><strong>${state.goals.targetWeight ? `${e(state.goals.targetWeight)} kg` : "Sin objetivo definido"}</strong><small>${state.goals.targetWeight && latest ? `Último registro: ${latest.weight} kg · diferencia: ${Math.abs(Number(state.goals.targetWeight) - Number(latest.weight)).toFixed(1)} kg` : "Este objetivo es opcional. Actualízalo en tu perfil."}</small></div></div></section>
  <section class="panel log-panel"><div class="panel-heading"><div><span class="eyebrow">REGISTRO OPCIONAL</span><h2>Seguimiento de peso</h2></div></div><form id="weight-form" class="weight-form"><div class="field"><label for="weight-value">Peso (kg)</label><input id="weight-value" name="weight" type="number" min="20" max="350" step="0.1" required placeholder="Ej. 68.5"></div><div class="field"><label for="weight-date">Fecha</label><input id="weight-date" name="date" type="date" max="${today()}" value="${today()}" required></div><button class="button button-primary" type="submit">Guardar registro</button></form><div class="weight-history">${weights.slice().reverse().slice(0, 6).map(item => `<div><span>${formatDate(item.date)}</span><strong>${e(item.weight)} kg</strong><button class="icon-button danger-icon" data-action="delete-weight" data-id="${e(item.id)}" aria-label="Eliminar registro del ${formatDate(item.date)}">×</button></div>`).join("") || '<p class="muted">No hay registros. Puedes añadir uno cuando quieras.</p>'}</div></section>
  <section class="panel full-history"><div class="panel-heading"><div><span class="eyebrow">HISTORIAL COMPLETO</span><h2>Entrenamientos guardados</h2></div><span class="activity-tag">${state.workouts.length} sesiones</span></div>${state.workouts.length ? `<div class="activity-list">${[...state.workouts].sort((a, b) => b.date.localeCompare(a.date)).map(item => `<div class="activity-row"><span class="activity-symbol">${item.demo ? "D" : "✓"}</span><div><strong>${e(item.name || "Entrenamiento")}${item.demo ? " · DEMO" : ""}</strong><small>${formatDate(item.date)} · ${Number(item.duration) || 0} min · ${Number(item.exerciseCount) || 0} ejercicios</small></div><span class="activity-tag">${e(item.goal || "Completado")}</span></div>`).join("")}</div>` : empty("◷", "Aún no hay sesiones", "Al finalizar un entrenamiento, se guardará aquí.")}</section>
  <div class="notice-card"><span>ⓘ</span><p>Las variaciones de peso son normales y no miden por sí solas la salud o el rendimiento. La gráfica solo representa los datos que introduces.</p></div>`;
}

function toolsView() {
  const p = state.profile;
  const bmi = Number(p.weight) && Number(p.height) ? Number(p.weight) / ((Number(p.height) / 100) ** 2) : null;
  const calories = Number(p.weight) ? Math.round(Number(p.weight) * 24 * (p.level === "Avanzado" ? 1.65 : p.level === "Intermedio" ? 1.5 : 1.35)) : null;
  const bmiLabel = !bmi ? "Añade estatura y peso en tu perfil" : bmi < 18.5 ? "Por debajo del rango orientativo" : bmi < 25 ? "Dentro del rango orientativo" : bmi < 30 ? "Por encima del rango orientativo" : "Rango alto; consulta a un profesional";
  return `${pageHeading("DATOS ORIENTATIVOS", "Herramientas <em>para conocerte.</em>", "Cálculos sencillos con sus límites explicados.")}
  <div class="tools-grid"><article class="panel calculator-card"><div class="calculator-icon">⌁</div><span class="eyebrow">ÍNDICE DE MASA CORPORAL</span><h2>IMC orientativo</h2><p>Relación entre peso y estatura; no mide composición corporal ni diagnostica.</p><div class="calc-result">${bmi ? `<strong>${bmi.toFixed(1)}</strong><span>${e(bmiLabel)}</span>` : `<strong>—</strong><span>${e(bmiLabel)}</span>`}</div><div class="calc-inputs"><span>Peso <b>${p.weight ? `${e(p.weight)} kg` : "No indicado"}</b></span><span>Estatura <b>${p.height ? `${e(p.height)} cm` : "No indicada"}</b></span></div><a class="text-link" href="#profile" data-view="profile">Actualizar datos →</a></article>
  <article class="panel calculator-card"><div class="calculator-icon calorie-icon">✳</div><span class="eyebrow">REFERENCIA ENERGÉTICA</span><h2>Estimación calórica</h2><p>Estimación muy general para conversar sobre necesidades, no una prescripción.</p><div class="calc-result">${calories ? `<strong>${calories.toLocaleString("es")}<small> kcal/día</small></strong><span>Referencia aproximada de mantenimiento</span>` : '<strong>—</strong><span>Indica tu peso en el perfil para obtener un rango</span>'}</div><div class="calc-inputs"><span>Basada en <b>peso y nivel declarado</b></span><span>Edad y actividad diaria <b>no consideradas</b></span></div><p class="disclaimer-copy">No se usa para fijar dietas ni objetivos de pérdida de peso. Las necesidades individuales varían ampliamente; consulta a un profesional de nutrición.</p></article></div>
  <div class="notice-card warning"><span>ⓘ</span><p>El IMC tiene limitaciones importantes (por ejemplo, no distingue músculo de grasa) y estos cálculos no sustituyen evaluación médica. No tomes decisiones de salud solo con esta pantalla.</p></div>`;
}

function assistantView() {
  const weekly = getWeeklyCount();
  const goal = state.profile.goal;
  const primarySport = SPORTS.find(sport => sport.id === state.profile.mainSport);
  const suggestions = [];
  if (!state.profile.age || !state.profile.height || !state.profile.weight) suggestions.push({ title: "Completa tu perfil si quieres", copy: "Con edad, estatura y peso podrás ver estimaciones orientativas. Todos esos datos son opcionales.", view: "profile", icon: "◎" });
  if (!state.workouts.length) suggestions.push({ title: `Empieza con una sesión para ${primarySport?.name || "tu deporte"}`, copy: `Tu plan prioriza ${state.profile.sessionMinutes || 30} minutos por sesión y ${state.goals.weeklySessions} días por semana. Empieza con un esfuerzo cómodo.`, view: "routines", icon: "↗" });
  else if (weekly >= state.goals.weeklySessions) suggestions.push({ title: "Objetivo semanal alcanzado", copy: `Ya completaste ${weekly} sesiones esta semana. Descansar también forma parte de entrenar.`, view: "calendar", icon: "✦" });
  else suggestions.push({ title: "Un siguiente paso realista", copy: `Llevas ${weekly} de ${state.goals.weeklySessions} sesiones esta semana. Una sesión breve puede ayudarte a acercarte a tu objetivo.`, view: "workout", icon: "◷" });
  suggestions.push({ title: `Base complementaria para ${primarySport?.name || "tu actividad"}`, copy: primarySport?.focus || "Elige un deporte en tu perfil para adaptar la orientación.", view: "routines", icon: "◎" });
  if (state.profile.sports?.length > 1) suggestions.push({ title: "Practicas varios deportes", copy: `También registraste: ${state.profile.sports.filter(id => id !== state.profile.mainSport).map(id => SPORTS.find(sport => sport.id === id)?.name || id).join(", ")}. Cambia el deporte priorizado en Rutinas para alternar el enfoque.`, view: "routines", icon: "↗" });
  if (state.profile.limitations) suggestions.push({ title: "Ten presente tu preferencia de movimiento", copy: `Indicastes: ${state.profile.limitations}. La aplicación no interpreta restricciones ni reemplaza la guía de un profesional; omite movimientos no adecuados para ti.`, view: "profile", icon: "ⓘ" });
  return `${pageHeading("ORIENTACIÓN SIN HUMO", "Tu coach <em>local.</em>", "Recomendaciones basadas en reglas simples y tus datos guardados aquí.")}
  <div class="assistant-banner"><div class="assistant-avatar">✦</div><div><span class="eyebrow">ASISTENTE DE ONNY</span><h2>Hola${state.profile.name ? `, ${e(state.profile.name.split(/\s+/)[0])}` : ""}. ¿Cuál es tu próximo paso?</h2><p>Estas sugerencias son reglas locales; no utilizo inteligencia artificial externa ni envío tus datos a ningún servicio.</p></div><span class="assistant-local-badge"><i></i> SOLO LOCAL</span></div><article class="panel sport-guide"><div class="sport-guide-heading"><span class="guide-icon">◎</span><div><span class="eyebrow">TU DEPORTE PRIORITARIO</span><h2>${e(primarySport?.name || "Actividad general")}</h2></div></div><p>${e(primarySport?.description || "Acondicionamiento general.")}</p><div class="sport-guide-focus"><strong>Qué orienta este plan</strong><span>${e(primarySport?.focus || "Elige un deporte en tu perfil para recibir recomendaciones orientadas.")}</span></div>  <div class="sport-guide-tags"><span>${e(state.profile.sportExperience || state.profile.level)} en este deporte</span><span>${state.profile.practiceDays || 0} días de práctica habitual</span><span>${state.goals.weeklySessions} sesiones complementarias / semana</span><span>${state.profile.sessionMinutes || 30} min / sesión</span><span>${e(state.profile.trainingLocation || "Lugar no indicado")}</span></div>${state.profile.practiceMinutes ? `<p class="sports-secondary">Duración habitual declarada: ${state.profile.practiceMinutes} min por práctica. Ajusta la carga complementaria a tu recuperación.</p>` : ""}${state.profile.sports?.length > 1 ? `<p class="sports-secondary"><strong>Otros deportes seleccionados:</strong> ${e(state.profile.sports.filter(id => id !== state.profile.mainSport).map(id => SPORTS.find(sport => sport.id === id)?.name || id).join(", "))}</p>` : ""}<a class="text-link" href="#profile" data-view="profile">Actualizar mis respuestas →</a></article><div class="suggestion-list">${suggestions.map((item, index) => `<article class="panel suggestion-card"><span class="suggestion-index">0${index + 1}</span><span class="suggestion-icon">${item.icon}</span><div><h3>${e(item.title)}</h3><p>${e(item.copy)}</p></div><a class="text-link" href="#${item.view}" data-view="${item.view}" aria-label="Ir a ${e(item.title)}">→</a></article>`).join("")}</div>
  <div class="notice-card"><span>ⓘ</span><p>El coach local no sustituye a un entrenador cualificado, fisioterapeuta o profesional de la salud. Si tienes molestias o una condición médica, pide asesoramiento personalizado.</p></div>`;
}

function profileView() {
  const p = state.profile;
  const chosenSports = p.sports?.length ? p.sports : (p.mainSport ? [p.mainSport] : []);
  return `${pageHeading("TU PUNTO DE PARTIDA", "Mi <em>perfil.</em>", "Tus datos solo se guardan en este navegador. Los campos físicos son opcionales.")}
  <section class="profile-layout"><div class="profile-aside panel"><div class="profile-avatar">${avatar()}</div><h2>${e(p.name || "Tu nombre")}</h2><p>${e(p.email || "Perfil local")}</p><span class="profile-level">${e(p.level || "Principiante")}</span><div class="profile-note"><span>ⓘ</span><p>El deporte y la experiencia guían las recomendaciones físicas generales; no son un plan médico o técnico individual.</p></div></div><form class="panel profile-form" id="profile-form"><div class="panel-heading"><div><span class="eyebrow">INFORMACIÓN PERSONAL Y DEPORTIVA</span><h2>Tu perfil</h2></div></div><div class="form-grid"><div class="field"><label for="profile-name">Nombre para mostrar</label><input id="profile-name" name="name" required minlength="2" maxlength="60" value="${e(p.name)}" placeholder="Tu nombre"></div><div class="field"><label for="profile-email">Correo electrónico (opcional)</label><input id="profile-email" name="email" type="email" value="${e(p.email)}" placeholder="tu@correo.com"></div><div class="field"><label for="profile-age">Edad (opcional)</label><input id="profile-age" name="age" type="number" min="13" max="110" value="${e(p.age)}" placeholder="Ej. 28"></div><div class="field"><label for="profile-height">Estatura (cm, opcional)</label><input id="profile-height" name="height" type="number" min="100" max="250" step="0.1" value="${e(p.height)}" placeholder="Ej. 170"></div><div class="field"><label for="profile-weight">Peso (kg, opcional)</label><input id="profile-weight" name="weight" type="number" min="20" max="350" step="0.1" value="${e(p.weight)}" placeholder="Ej. 68.5"></div><div class="field"><label for="profile-level">Nivel físico</label><select id="profile-level" name="level">${["Principiante", "Intermedio", "Avanzado"].map(level => `<option ${level === p.level ? "selected" : ""}>${level}</option>`).join("")}</select></div>
  <fieldset class="field full profile-sport-field"><legend>Deportes que practicas</legend><div class="sports-choice-grid compact-sports">${SPORTS.map(sport => `<label class="sport-choice"><input type="checkbox" name="sports" value="${sport.id}" ${chosenSports.includes(sport.id) ? "checked" : ""}><span class="sport-choice-icon">◎</span><span><strong>${e(sport.name)}</strong><small>${e(sport.description)}</small></span><i class="choice-check">✓</i></label>`).join("")}</div></fieldset>
  <div class="field"><label for="profile-main-sport">Deporte que quieres priorizar</label><select id="profile-main-sport" name="mainSport">${SPORTS.map(sport => `<option value="${sport.id}" ${sport.id === (p.mainSport || "multideporte") ? "selected" : ""}>${e(sport.name)}</option>`).join("")}</select></div><div class="field"><label for="profile-sport-experience">Experiencia en el deporte</label><select id="profile-sport-experience" name="sportExperience">${["Principiante", "Intermedio", "Avanzado"].map(level => `<option ${level === (p.sportExperience || p.level) ? "selected" : ""}>${level}</option>`).join("")}</select></div>
  <div class="field full"><label for="profile-goal">Objetivo principal</label><select id="profile-goal" name="goal">${["Mejorar mi condición física", "Preparación física para mi deporte", "Ganar fuerza", "Mejorar resistencia", "Movilidad y bienestar"].map(goal => `<option ${goal === p.goal ? "selected" : ""}>${e(goal)}</option>`).join("")}</select></div>
  <div class="field"><label for="profile-practice-days">Días que practicas tu deporte</label><select id="profile-practice-days" name="practiceDays">${[["0", "No practico actualmente"], ["1", "1 día"], ["2", "2 días"], ["3", "3 días"], ["4", "4 días"], ["5", "5 días"], ["6", "6 días"], ["7", "Todos los días"]].map(([value, label]) => `<option value="${value}" ${Number(value) === Number(p.practiceDays) ? "selected" : ""}>${label}</option>`).join("")}</select></div>
  <div class="field"><label for="profile-practice-minutes">Duración aproximada de cada práctica</label><select id="profile-practice-minutes" name="practiceMinutes">${[["0", "No lo sé / no practico"], ["30", "Hasta 30 minutos"], ["60", "30–60 minutos"], ["90", "60–90 minutos"], ["120", "Más de 90 minutos"]].map(([value, label]) => `<option value="${value}" ${Number(value) === Number(p.practiceMinutes) ? "selected" : ""}>${label}</option>`).join("")}</select></div>
  <div class="field"><label for="profile-session-minutes">Tiempo para cada sesión complementaria</label><select id="profile-session-minutes" name="sessionMinutes">${[15, 20, 30, 45, 60].map(minutes => `<option value="${minutes}" ${minutes === Number(p.sessionMinutes || 30) ? "selected" : ""}>${minutes} minutos</option>`).join("")}</select></div>
  <div class="field"><label for="profile-location">Lugar habitual</label><select id="profile-location" name="trainingLocation">${["Casa", "Gimnasio", "Parque o exterior", "Cancha o club", "Piscina", "Otro lugar"].map(location => `<option ${location === p.trainingLocation ? "selected" : ""}>${location}</option>`).join("")}</select></div>
  <fieldset class="field full equipment-field"><legend>Equipamiento disponible</legend><div class="choice-row">${["Sin equipo", "Mancuernas", "Bandas"].map(item => `<label class="choice-chip"><input type="checkbox" name="equipment" value="${item}" ${(p.equipment || ["Sin equipo"]).includes(item) ? "checked" : ""}><span>${item}</span></label>`).join("")}</div></fieldset>
  <div class="field full"><label for="profile-limitations">Movimientos que prefieres evitar (opcional)</label><textarea id="profile-limitations" name="limitations" maxlength="180" rows="2" placeholder="No incluyas información médica personal.">${e(p.limitations)}</textarea><small>La app no interpreta ni diagnostica restricciones físicas.</small></div>
  <div class="field"><label for="weekly-goal">Sesiones objetivo por semana</label><select id="weekly-goal" name="weeklySessions">${[1, 2, 3, 4, 5, 6, 7].map(count => `<option value="${count}" ${count === state.goals.weeklySessions ? "selected" : ""}>${count} ${count === 1 ? "día" : "días"}</option>`).join("")}</select></div><div class="field"><label for="target-weight">Peso objetivo (opcional)</label><input id="target-weight" name="targetWeight" type="number" min="20" max="350" step="0.1" value="${e(state.goals.targetWeight)}" placeholder="kg"></div></div><div class="form-actions"><button class="button button-primary" type="submit">Guardar perfil <span>✓</span></button></div></form></section>`;
}

function settingsView() {
  return `${pageHeading("CONTROL DE TUS DATOS", "Configuración <em>y privacidad.</em>", "Tus datos viven en este navegador. Tú decides cómo gestionarlos.")}
  <div class="settings-grid"><section class="panel settings-card"><span class="settings-icon">⇩</span><div><h2>Exportar copia</h2><p>Descarga rutinas, perfil e historial en un archivo JSON legible.</p></div><button class="button button-secondary" data-action="export">Exportar JSON</button></section>
  <section class="panel settings-card"><span class="settings-icon">⇧</span><div><h2>Importar copia</h2><p>Restaura una copia JSON de ONNY COACH. Los datos actuales serán reemplazados.</p></div><label class="button button-secondary file-button">Elegir archivo<input type="file" id="import-file" accept="application/json,.json" hidden></label></section>
  <section class="panel settings-card"><span class="settings-icon">✦</span><div><h2>Datos de demostración</h2><p>Carga actividad sintética marcada como DEMO para una presentación. Reemplazará los datos actuales.</p></div><button class="button button-outline" data-action="load-demo">Cargar demo</button></section>
  <section class="panel settings-card"><span class="settings-icon danger-text">⌫</span><div><h2>Eliminar todos mis datos</h2><p>Borra definitivamente los datos locales de entrenamiento y el perfil guardado.</p></div><button class="button button-danger-outline" data-action="clear-data">Eliminar datos</button></section></div>
  <section class="panel privacy-panel"><span class="eyebrow">TRANSPARENCIA</span><h2>Sobre este prototipo</h2><ul><li>El perfil, las rutinas y las sesiones se guardan en el almacenamiento local de este navegador.</li><li>La autenticación es solo una demostración: no hay backend, verificación de identidad ni cifrado. No es segura para producción.</li><li>La contraseña no se guarda en localStorage ni se envía; este prototipo no puede verificar credenciales reales.</li><li>Las estimaciones de IMC y calorías son orientativas y no sustituyen consejo profesional.</li><li>Exporta una copia si quieres conservar tus datos antes de borrar los datos del navegador.</li></ul></section>`;
}

function drawCharts() {
  clearTimeout(chartResizeHandle);
  chartResizeHandle = setTimeout(() => {
    document.querySelectorAll("canvas[data-chart]").forEach(canvas => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      if (!rect.width || !rect.height) return;
      canvas.width = rect.width * ratio;
      canvas.height = rect.height * ratio;
      const ctx = canvas.getContext("2d");
      ctx.scale(ratio, ratio);
      const width = rect.width, height = rect.height;
      const padding = { top: 16, right: 12, bottom: 30, left: 30 };
      const innerW = width - padding.left - padding.right, innerH = height - padding.top - padding.bottom;
      ctx.font = "11px DM Sans, sans-serif";
      ctx.fillStyle = "#79839a";
      ctx.strokeStyle = "rgba(151,165,190,.12)";
      let values, labels;
      if (canvas.dataset.chart === "weight") {
        const sorted = [...state.weightLog].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
        values = sorted.map(item => Number(item.weight));
        labels = sorted.map(item => item.date.slice(5));
      } else {
        const currentWeek = getWeekDates();
        const weeks = Array.from({ length: 6 }, (_, index) => {
          const start = new Date(currentWeek[0]); start.setDate(start.getDate() - (5 - index) * 7);
          const end = new Date(start); end.setDate(end.getDate() + 6);
          return { label: `${start.getDate()}/${start.getMonth() + 1}`, count: state.workouts.filter(item => item.date >= dateKey(start) && item.date <= dateKey(end)).length };
        });
        values = weeks.map(item => item.count);
        labels = weeks.map(item => item.label);
      }
      if (!values.length) return;
      const max = Math.max(...values);
      const min = canvas.dataset.chart === "weight" ? Math.min(...values) : 0;
      const spread = Math.max(max - min, canvas.dataset.chart === "weight" ? 1 : max || 1);
      for (let i = 0; i <= 3; i++) {
        const y = padding.top + innerH * i / 3;
        ctx.beginPath(); ctx.moveTo(padding.left, y); ctx.lineTo(width - padding.right, y); ctx.stroke();
        const label = canvas.dataset.chart === "weight" ? (max - spread * i / 3).toFixed(0) : Math.round(max * (1 - i / 3));
        ctx.fillText(String(label), 2, y + 4);
      }
      const points = values.map((value, i) => ({ x: padding.left + innerW * (values.length === 1 ? 0.5 : i / (values.length - 1)), y: padding.top + innerH * (1 - (value - min) / spread), value, label: labels[i] }));
      if (canvas.dataset.chart === "activity") {
        const slot = innerW / Math.max(points.length, 1);
        points.forEach(point => {
          const barHeight = (point.value / spread) * innerH;
          const gradient = ctx.createLinearGradient(0, point.y, 0, height - padding.bottom);
          gradient.addColorStop(0, "#56a1ff"); gradient.addColorStop(1, "rgba(70,132,255,.25)");
          ctx.fillStyle = gradient;
          ctx.beginPath(); ctx.roundRect(point.x - slot * .24, point.y, slot * .48, Math.max(2, barHeight), 5); ctx.fill();
        });
      } else {
        ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
        ctx.strokeStyle = "#59a5ff"; ctx.lineWidth = 2.5; ctx.stroke();
        points.forEach(point => { ctx.fillStyle = "#0e1524"; ctx.strokeStyle = "#71b5ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); });
      }
      ctx.fillStyle = "#79839a";
      points.forEach(point => ctx.fillText(point.label, point.x - ctx.measureText(point.label).width / 2, height - 7));
    });
  }, 30);
}

function getFormData(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function exerciseSportBenefit(exercise, sportId) {
  const explicitBenefit = exercise.sportBenefits?.[sportId];
  if (explicitBenefit) return explicitBenefit;
  const sport = SPORTS.find(item => item.id === sportId);
  return sport ? `Este movimiento trabaja ${exercise.muscles.toLowerCase()} como acondicionamiento general. ${sport.focus}` : exercise.benefit || "Acondicionamiento físico general complementario.";
}

function buildRoutine({ sportId, goal, level, minutes, equipment }) {
  const sport = SPORTS.find(item => item.id === sportId);
  if (!sport) throw new Error("Selecciona un deporte válido para crear esta rutina.");
  const cardioFocus = goal.toLowerCase().includes("resistencia") && sportId === "correr" && Number(minutes) >= 20;
  const limit = cardioFocus
    ? Math.min(3, Math.max(1, Math.floor((Number(minutes) - 20) / 10) + 1))
    : Math.max(2, Math.min(8, Math.floor(Number(minutes) / 5)));
  let candidates = sport.exerciseIds.map(id => EXERCISE_BY_ID.get(id)).filter(item => item &&
    (item.equipment.includes("Sin equipo") || item.equipment.some(tool => equipment.includes(tool))) &&
    (level !== "Principiante" || item.level === "Principiante"));
  if (cardioFocus) candidates.sort((a, b) => Number(b.category === "Cardio") - Number(a.category === "Cardio"));
  if (goal.toLowerCase().includes("movilidad")) candidates = candidates.filter(item => item.category === "Movilidad" || item.category === "Coordinación" || item.category === "Core");
  if (goal.toLowerCase().includes("fuerza")) candidates = candidates.filter(item => item.category === "Fuerza" || item.category === "Core");
  const minimumExercises = cardioFocus ? 1 : 2;
  if (candidates.length < minimumExercises) throw new Error(`Con esta combinación de deporte, experiencia y objetivo encontramos menos de ${minimumExercises} ejercicios. Prueba otro objetivo o un nivel distinto.`);
  if (goal.toLowerCase().includes("resistencia") && !cardioFocus) candidates.sort((a, b) => Number(b.category === "Cardio") - Number(a.category === "Cardio"));
  if (level === "Principiante") candidates = candidates.filter(item => item.level === "Principiante");
  const selected = candidates.slice(0, limit).map(item => item.id);
  if (selected.length < minimumExercises) throw new Error("No hay suficientes ejercicios para esa combinación. Ajusta el tiempo, nivel u objetivo.");
  return { id: crypto.randomUUID(), name: `${sport.name} · ${goal} · ${minutes} min`, sportId, goal, level, minutes: Number(minutes), equipment: [...equipment], exerciseIds: selected, createdAt: new Date().toISOString() };
}

function makeRoutine(options) {
  const routine = buildRoutine(options);
  state.routines.unshift(routine);
  state.currentRoutine = routine;
  persist();
  return routine;
}

function beginWorkout(ids = null, name = null, goal = null, sportId = null) {
  const routine = routineForSession();
  const exerciseIds = (ids || routine.exerciseIds).filter(id => EXERCISE_BY_ID.has(id));
  if (!exerciseIds.length) return notify("Esta rutina no tiene ejercicios disponibles.", "error");
  session = { id: crypto.randomUUID(), name: name || routine.name, goal: goal || routine.goal, sportId: sportId || routine.sportId || state.profile.mainSport, exerciseIds: [...exerciseIds], index: 0, startedAt: Date.now(), pausedAt: null, pausedMs: 0, restLeft: 0, demo: false };
  activeView = "workout";
  render();
  tickHandle = setInterval(tick, 1000);
}

function tick() {
  if (!session) return;
  if (session.restLeft > 0 && !session.pausedAt) {
    session.restLeft--;
    const restButton = document.querySelector('[data-action="rest-timer"]');
    if (restButton) restButton.textContent = `◷ Descanso ${formatDuration(session.restLeft)}`;
    if (session.restLeft === 0) notify("Descanso terminado. Continúa cuando estés lista.", "success");
  }
  const timer = document.querySelector("#elapsed-timer");
  if (timer) {
    const elapsed = Math.floor((Date.now() - session.startedAt - session.pausedMs - (session.pausedAt ? Date.now() - session.pausedAt : 0)) / 1000);
    timer.textContent = formatDuration(Math.max(0, elapsed));
  }
}

function endWorkout() {
  if (!session) return;
  const elapsed = Math.max(1, Math.round((Date.now() - session.startedAt - session.pausedMs - (session.pausedAt ? Date.now() - session.pausedAt : 0)) / 60000));
  const workout = { id: session.id, name: session.name, goal: session.demo ? "DEMO · datos de ejemplo" : session.goal, sportId: session.sportId || state.profile.mainSport, date: today(), duration: elapsed, exerciseCount: session.exerciseIds.length, demo: session.demo };
  state.workouts.push(workout);
  state.completedDates = [...new Set([...state.completedDates, workout.date])];
  clearInterval(tickHandle); tickHandle = null; session = null;
  persist();
  activeView = "dashboard";
  render();
  notify("Sesión guardada. ¡Buen trabajo!");
}

function demoData() {
  const makeDate = days => { const date = new Date(); date.setDate(date.getDate() - days); return dateKey(date); };
  state.profile = { ...state.profile, name: "Alex Demo", email: "", age: "28", height: "170", weight: "68.5", level: "Intermedio", goal: "Preparación física para mi deporte", equipment: ["Sin equipo", "Mancuernas"], sports: ["futbol"], mainSport: "futbol", otherSport: "", sportExperience: "Intermedio", trainingLocation: "Cancha o club", limitations: "", practiceDays: 2, practiceMinutes: 90, sessionMinutes: 30, onboardingComplete: true };
  state.goals = { weeklySessions: 3, targetWeight: "" };
  state.workouts = [14, 12, 10, 8, 6, 3, 1].map((days, index) => ({ id: crypto.randomUUID(), name: ["Rutina de fuerza", "Circuito de cuerpo completo", "Cardio suave"][index % 3], goal: "DEMO · datos de ejemplo", date: makeDate(days), duration: 22 + index * 3, exerciseCount: 4, demo: true }));
  state.weightLog = [30, 23, 16, 9, 2].map((days, index) => ({ id: crypto.randomUUID(), date: makeDate(days), weight: [70.2, 69.8, 69.5, 69, 68.5][index], demo: true }));
  state.routines = [{ id: crypto.randomUUID(), name: "Fútbol · rutina demo · cuerpo completo", sportId: "futbol", goal: "Preparación física para mi deporte", level: "Intermedio", minutes: 30, equipment: ["Sin equipo", "Mancuernas"], exerciseIds: ["squat", "lunge", "bridge", "calf-raise", "plank"], demo: true }];
  state.currentRoutine = state.routines[0];
  state.completedDates = state.workouts.map(item => item.date);
  persist();
  notify("Datos sintéticos DEMO cargados. Puedes eliminarlos desde Configuración.");
  render();
}

function authMode(mode) {
  const form = document.querySelector("#auth-form");
  if (!form) return;
  form.dataset.mode = mode;
  document.querySelectorAll(".auth-tab").forEach(tab => {
    const active = tab.dataset.authMode === mode;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
  });
  const name = document.querySelector(".auth-name");
  name.hidden = mode === "login";
  document.querySelector("#auth-name").required = mode === "register";
  document.querySelector("#auth-password").autocomplete = mode === "login" ? "current-password" : "new-password";
  document.querySelector(".auth-submit-label").textContent = mode === "login" ? "Entrar a mi espacio" : "Crear mi espacio";
}

app.addEventListener("click", event => {
  const target = event.target.closest("[data-action], [data-view], [data-auth-mode], [data-filter]");
  if (!target) return;
  if (target.dataset.authMode) { authMode(target.dataset.authMode); return; }
  if (target.dataset.filter) { exerciseFilter = target.dataset.filter; render(); return; }
  if (target.dataset.view) {
    event.preventDefault();
    activeView = target.dataset.view;
    document.querySelector(".sidebar")?.classList.remove("menu-open");
    render();
    return;
  }
  const id = target.dataset.id;
  switch (target.dataset.action) {
    case "next-onboarding":
      if (validateOnboardingStep(onboardingStep)) setOnboardingStep(onboardingStep + 1);
      break;
    case "back-onboarding": setOnboardingStep(onboardingStep - 1); break;
    case "toggle-menu": {
      const sidebar = document.querySelector(".sidebar");
      sidebar.classList.toggle("menu-open");
      target.setAttribute("aria-expanded", String(sidebar.classList.contains("menu-open")));
      break;
    }
    case "close-menu":
      document.querySelector(".sidebar")?.classList.remove("menu-open");
      document.querySelector(".menu-toggle")?.setAttribute("aria-expanded", "false");
      break;
    case "logout":
      sessionStorage.removeItem("onny-coach-session");
      clearInterval(tickHandle); session = null; render(); break;
    case "visitor": enterApp({}, "Sesión local iniciada como visitante."); break;
    case "start-workout": activeView = "workout"; render(); break;
    case "begin-workout": beginWorkout(); break;
    case "pause-workout":
      if (session.pausedAt) { session.pausedMs += Date.now() - session.pausedAt; session.pausedAt = null; }
      else session.pausedAt = Date.now();
      render();
      break;
    case "next-exercise":
      if (session.index >= session.exerciseIds.length - 1) endWorkout();
      else { session.index++; session.restLeft = 0; render(); }
      break;
    case "rest-timer":
      if (session.restLeft) { session.restLeft = 0; target.textContent = "◷ Iniciar descanso"; }
      else { session.restLeft = EXERCISE_BY_ID.get(session.exerciseIds[session.index])?.rest || 60; target.textContent = `◷ Descanso ${formatDuration(session.restLeft)}`; }
      break;
    case "end-workout":
      if (confirm("¿Finalizar y guardar esta sesión?")) endWorkout();
      break;
    case "use-routine": {
      state.currentRoutine = state.routines.find(item => item.id === id) || null; persist();
      beginWorkout(state.currentRoutine.exerciseIds, state.currentRoutine.name, state.currentRoutine.goal, state.currentRoutine.sportId);
      break;
    }
    case "delete-routine":
      if (confirm("¿Eliminar esta rutina guardada?")) { state.routines = state.routines.filter(item => item.id !== id); if (state.currentRoutine?.id === id) state.currentRoutine = state.routines[0] || null; persist(); render(); notify("Rutina eliminada."); }
      break;
    case "quick-exercise": {
      const exercise = EXERCISE_BY_ID.get(id);
      if (exercise) beginWorkout([id], `${exercise.name} · ${SPORTS.find(sport => sport.id === state.profile.mainSport)?.name || "Sesión complementaria"}`, exercise.category, state.profile.mainSport);
      break;
    }
    case "delete-weight":
      if (confirm("¿Eliminar este registro de peso?")) { state.weightLog = state.weightLog.filter(item => item.id !== id); persist(); render(); notify("Registro eliminado."); }
      break;
    case "export": exportState(state); notify("Copia JSON descargada."); break;
    case "load-demo":
      if (confirm("Los datos actuales serán reemplazados por ejemplos sintéticos marcados como DEMO. ¿Continuar?")) demoData();
      break;
    case "clear-data":
      if (confirm("Esto eliminará permanentemente perfil, rutinas e historial guardados en este navegador. ¿Continuar?")) {
        localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem("onny-coach-session"); clearInterval(tickHandle); state = loadState(); session = null; render(); notify("Datos locales eliminados.");
      }
      break;
    case "prev-week": calendarWeekOffset--; render(); break;
    case "next-week": calendarWeekOffset = Math.min(0, calendarWeekOffset + 1); render(); break;
  }
});

app.addEventListener("input", event => {
  if (event.target.id === "exercise-search") {
    const cursor = event.target.selectionStart;
    searchQuery = event.target.value;
    render();
    const input = document.querySelector("#exercise-search");
    input.focus(); input.setSelectionRange(cursor, cursor);
  }
});

app.addEventListener("change", async event => {
  if (event.target.closest("#onboarding-form")) {
    updateSportSelection(event.target.closest("form"), event.target);
    return;
  }
  if (event.target.closest("#profile-form")) {
    const form = event.target.closest("form");
    const chosen = new FormData(form).getAll("sports");
    if (event.target.name === "mainSport" && event.target.value && !chosen.includes(event.target.value)) {
      const checkbox = form.querySelector(`input[name="sports"][value="${CSS.escape(event.target.value)}"]`);
      if (checkbox) checkbox.checked = true;
    }
    return;
  }
  if (event.target.id === "routine-sport") {
    updateSportSelection(event.target.form, event.target);
    return;
  }
  if (event.target.id !== "import-file" || !event.target.files?.length) return;
  const file = event.target.files[0];
  try {
    if (file.size > 2_000_000) throw new Error("El archivo supera el límite de 2 MB.");
    const parsed = JSON.parse(await file.text());
    const imported = validateState(parsed);
    if (!confirm("Importar reemplazará todos los datos locales actuales. ¿Continuar?")) return;
    state = imported; persist(); render(); notify("Copia importada correctamente.");
  } catch (error) {
    notify(`No se pudo importar la copia: ${error.message}`, "error");
  } finally {
    event.target.value = "";
  }
});

app.addEventListener("submit", event => {
  const form = event.target;
  event.preventDefault();
  if (form.id === "onboarding-form") {
    if (!validateOnboardingStep(0) || !validateOnboardingStep(1) || !validateOnboardingStep(2)) {
      if (!validateOnboardingStep(0)) onboardingStep = 0;
      else if (!validateOnboardingStep(1)) onboardingStep = 1;
      setOnboardingStep(onboardingStep);
      return;
    }
    const data = getFormData(form);
    const sports = new FormData(form).getAll("sports");
    const equipment = new FormData(form).getAll("equipment");
    const previousWeight = Number(state.profile.weight);
    const age = data.age ? Number(data.age) : "";
    const height = data.height ? Number(data.height) : "";
    const weight = data.weight ? Number(data.weight) : "";
    if (!equipment.length) equipment.push("Sin equipo");
    state.profile = {
      ...state.profile,
      name: data.name.trim().slice(0, 60),
      age: String(age),
      height: String(height),
      weight: String(weight),
      level: data.level,
      goal: data.goal,
      sports,
      mainSport: data.mainSport,
      otherSport: data.mainSport === "otro" ? String(data.otherSport || "").trim().slice(0, 60) : "",
      sportExperience: data.sportExperience,
      trainingLocation: data.trainingLocation,
      limitations: String(data.limitations || "").trim().slice(0, 180),
      practiceDays: Number(data.practiceDays),
      practiceMinutes: Number(data.practiceMinutes),
      sessionMinutes: Number(data.sessionMinutes),
      equipment,
      onboardingComplete: true
    };
    state.goals = { ...state.goals, weeklySessions: Number(data.weeklySessions) };
    if (weight && previousWeight !== weight) state.weightLog.push({ id: crypto.randomUUID(), date: today(), weight });
    try {
      makeRoutine({ sportId: data.mainSport, goal: data.goal, level: data.sportExperience, minutes: data.sessionMinutes, equipment });
    } catch (error) {
      state.currentRoutine = null;
      persist();
      activeView = "dashboard";
      onboardingStep = 0;
      render();
      notify(`Perfil guardado, pero no se pudo crear la rutina inicial: ${error.message}`, "error");
      return;
    }
    activeView = "dashboard";
    onboardingStep = 0;
    render();
    notify(`Perfil guardado. Preparé una rutina inicial para ${SPORTS.find(sport => sport.id === data.mainSport)?.name || "tu deporte"}.`);
    return;
  }
  if (!form.reportValidity()) return;
  const data = getFormData(form);
  if (form.id === "auth-form") {
    const mode = form.dataset.mode || "register";
    const email = String(data.email).trim().toLowerCase();
    const password = String(data.password);
    if (!validEmail(email)) return notify("Escribe un correo electrónico válido.", "error");
    if (password.length < 8) return notify("La contraseña de demostración debe tener al menos 8 caracteres.", "error");
    if (mode === "register") {
      if (state.profile.email && state.profile.email !== email && state.profile.name) {
        if (!confirm("Este navegador ya tiene un perfil. Crear uno nuevo reemplazará el perfil local, rutinas e historial. ¿Continuar?")) return;
        state = loadState();
      }
      sessionCredentials.set(email, password);
      enterApp({ name: data.name, email }, "Cuenta local creada. Recuerda: esta autenticación es solo demostrativa.");
    } else {
      if (state.profile.email && email !== state.profile.email) return notify("No existe un perfil local con ese correo. Regístrate o continúa como visitante.", "error");
      if (sessionCredentials.has(email) && sessionCredentials.get(email) !== password) return notify("La contraseña de demostración no coincide en esta sesión.", "error");
      if (!state.profile.email) return notify("No hay un perfil guardado para ese correo. Crea una cuenta local.", "error");
      enterApp({ email }, "Sesión local iniciada. No se verificó una identidad real.");
    }
  } else if (form.id === "routine-form") {
    const equipment = new FormData(form).getAll("equipment");
    if (!equipment.length) return notify("Selecciona al menos una opción de equipamiento.", "error");
    try {
      const routine = makeRoutine({ ...data, equipment });
      activeView = "routines"; render(); notify(`Rutina para ${SPORTS.find(sport => sport.id === routine.sportId)?.name}: ${routine.exerciseIds.length} ejercicios.`);
    } catch (error) {
      notify(error.message, "error");
    }
  } else if (form.id === "profile-form") {
    const age = data.age === "" ? "" : Number(data.age);
    const height = data.height === "" ? "" : Number(data.height);
    const weight = data.weight === "" ? "" : Number(data.weight);
    if (age && (age < 13 || age > 110)) return notify("La edad debe estar entre 13 y 110 años.", "error");
    if (height && (height < 100 || height > 250)) return notify("La estatura debe estar entre 100 y 250 cm.", "error");
    if (weight && (weight < 20 || weight > 350)) return notify("El peso debe estar entre 20 y 350 kg.", "error");
    if (!validEmail(data.email) && data.email) return notify("Escribe un correo electrónico válido o deja el campo vacío.", "error");
    const sports = new FormData(form).getAll("sports");
    const mainSport = data.mainSport;
    if (!SPORTS.some(sport => sport.id === mainSport)) return notify("Elige un deporte prioritario válido.", "error");
    if (!sports.includes(mainSport)) sports.push(mainSport);
    if (data.targetWeight && (Number(data.targetWeight) < 20 || Number(data.targetWeight) > 350)) return notify("El peso objetivo debe estar entre 20 y 350 kg.", "error");
    if (!new Set(SPORTS.map(sport => sport.id)).size || sports.some(id => !SPORTS.some(sport => sport.id === id))) return notify("Revisa la selección de deportes.", "error");
    const previousWeight = Number(state.profile.weight);
    const equipment = new FormData(form).getAll("equipment");
    state.profile = { ...state.profile, name: data.name.trim().slice(0, 60), email: data.email.trim().toLowerCase(), age: String(age), height: String(height), weight: String(weight), level: data.level, goal: data.goal, sports, mainSport, sportExperience: data.sportExperience, trainingLocation: data.trainingLocation, practiceDays: Number(data.practiceDays), practiceMinutes: Number(data.practiceMinutes), sessionMinutes: Number(data.sessionMinutes), limitations: String(data.limitations || "").trim().slice(0, 180), equipment: equipment.length ? equipment : ["Sin equipo"], onboardingComplete: true };
    state.goals = { ...state.goals, weeklySessions: Number(data.weeklySessions), targetWeight: String(data.targetWeight || "") };
    if (weight && previousWeight !== weight) state.weightLog.push({ id: crypto.randomUUID(), date: today(), weight });
    state.currentRoutine = null;
    persist(); render(); notify("Perfil actualizado.");
  } else if (form.id === "weight-form") {
    const weight = Number(data.weight);
    if (!Number.isFinite(weight) || weight < 20 || weight > 350) return notify("El peso debe estar entre 20 y 350 kg.", "error");
    if (data.date > today()) return notify("La fecha no puede estar en el futuro.", "error");
    state.weightLog.push({ id: crypto.randomUUID(), date: data.date, weight });
    state.profile.weight = String(weight);
    persist(); render(); notify("Registro de peso guardado.");
  }
});

window.addEventListener("resize", drawCharts);
window.addEventListener("beforeunload", () => clearInterval(tickHandle));

if (sessionStorage.getItem("onny-coach-session") === "active") render();
else authScreen();
if (initialLoadError) notify(`No se pudieron leer los datos locales; se abrió un perfil vacío. ${initialLoadError}`, "error");
