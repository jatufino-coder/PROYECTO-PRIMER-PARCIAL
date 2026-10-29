const STORAGE_KEY = "onny-coach-v1";
let loadErrorMessage = "";

export function createInitialState() {
  return {
    version: 1,
    profile: { name: "", email: "", age: "", height: "", weight: "", level: "Principiante", goal: "Mejorar mi condición física", equipment: ["Sin equipo"], sports: [], mainSport: "", otherSport: "", sportExperience: "Principiante", trainingLocation: "Casa", limitations: "", practiceDays: 0, practiceMinutes: 0, sessionMinutes: 30, onboardingComplete: false },
    goals: { weeklySessions: 3, targetWeight: "" },
    workouts: [],
    weightLog: [],
    routines: [],
    currentRoutine: null,
    completedDates: [],
    createdAt: new Date().toISOString()
  };
}

export function loadState() {
  loadErrorMessage = "";
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createInitialState();
    const parsed = JSON.parse(raw);
    return validateState(parsed);
  } catch (error) {
    console.error("No se pudieron leer los datos guardados de ONNY COACH.", error);
    loadErrorMessage = error instanceof Error ? error.message : "Error desconocido al leer el almacenamiento.";
    return createInitialState();
  }
}

export function consumeLoadError() {
  const message = loadErrorMessage;
  loadErrorMessage = "";
  return message;
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function validateState(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("La copia no tiene un formato de datos válido.");
  if (value.version !== 1 || !value.profile || typeof value.profile !== "object") throw new Error("La copia no corresponde a una versión compatible de ONNY COACH.");
  const state = createInitialState();
  const profile = value.profile;
  for (const key of ["name", "email", "age", "height", "weight", "level", "goal", "mainSport", "otherSport", "sportExperience", "trainingLocation", "limitations"]) {
    if (profile[key] !== undefined && !["string", "number"].includes(typeof profile[key])) throw new Error(`El campo de perfil «${key}» no es válido.`);
    if (profile[key] !== undefined) state.profile[key] = String(profile[key]).slice(0, 120);
  }
  for (const [key, min, max] of [["age", 13, 110], ["height", 100, 250], ["weight", 20, 350]]) {
    const raw = profile[key];
    if (raw !== undefined && raw !== "" && (!Number.isFinite(Number(raw)) || Number(raw) < min || Number(raw) > max)) {
      throw new Error(`El dato de perfil «${key}» está fuera del rango permitido.`);
    }
  }
  if (profile.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(profile.email))) throw new Error("El correo guardado en el perfil no es válido.");
  if (profile.equipment !== undefined && (!Array.isArray(profile.equipment) || profile.equipment.some(item => typeof item !== "string"))) throw new Error("El equipamiento guardado en el perfil no es válido.");
  if (Array.isArray(profile.equipment)) state.profile.equipment = profile.equipment.slice(0, 12);
  if (profile.sports !== undefined && (!Array.isArray(profile.sports) || profile.sports.some(item => typeof item !== "string"))) throw new Error("La lista de deportes guardada en el perfil no es válida.");
  if (Array.isArray(profile.sports)) state.profile.sports = profile.sports.slice(0, 20);
  if (typeof profile.sessionMinutes === "number" && Number.isFinite(profile.sessionMinutes)) state.profile.sessionMinutes = Math.max(10, Math.min(180, profile.sessionMinutes));
  if (Number.isInteger(profile.practiceDays) && profile.practiceDays >= 0 && profile.practiceDays <= 7) state.profile.practiceDays = profile.practiceDays;
  if (Number.isInteger(profile.practiceMinutes) && profile.practiceMinutes >= 0 && profile.practiceMinutes <= 300) state.profile.practiceMinutes = profile.practiceMinutes;
  if (typeof profile.onboardingComplete === "boolean") state.profile.onboardingComplete = profile.onboardingComplete;
  if (value.goals !== undefined && (!value.goals || typeof value.goals !== "object" || Array.isArray(value.goals))) throw new Error("Los objetivos de la copia no son válidos.");
  if (value.goals) {
    if (value.goals.weeklySessions !== undefined && (!Number.isInteger(value.goals.weeklySessions) || value.goals.weeklySessions < 1 || value.goals.weeklySessions > 7)) throw new Error("El objetivo semanal debe estar entre 1 y 7 sesiones.");
    if (value.goals.targetWeight !== undefined && value.goals.targetWeight !== "") {
      const target = Number(value.goals.targetWeight);
      if (!Number.isFinite(target) || target < 20 || target > 350) throw new Error("El peso objetivo de la copia está fuera del rango permitido.");
    }
    if (Number.isInteger(value.goals.weeklySessions)) state.goals.weeklySessions = value.goals.weeklySessions;
    if (typeof value.goals.targetWeight === "string" || typeof value.goals.targetWeight === "number") state.goals.targetWeight = String(value.goals.targetWeight).slice(0, 10);
  }
  for (const key of ["workouts", "weightLog", "routines", "completedDates"]) {
    if (value[key] !== undefined && !Array.isArray(value[key])) throw new Error(`La sección «${key}» no es válida.`);
  }
  const validDate = date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(new Date(`${date}T00:00:00Z`).getTime()) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  const validWorkouts = (value.workouts || []).filter(item => item && typeof item === "object" && validDate(item.date));
  const validWeights = (value.weightLog || []).filter(item => item && typeof item === "object" && validDate(item.date) && Number.isFinite(Number(item.weight)) && Number(item.weight) >= 20 && Number(item.weight) <= 350);
  const validRoutines = (value.routines || []).filter(item => item && typeof item === "object" && typeof item.name === "string" && Array.isArray(item.exerciseIds) && item.exerciseIds.every(id => typeof id === "string"));
  const validCompletedDates = (value.completedDates || []).filter(validDate);
  if (validWorkouts.length !== (value.workouts || []).length || validWeights.length !== (value.weightLog || []).length || validRoutines.length !== (value.routines || []).length || validCompletedDates.length !== (value.completedDates || []).length) {
    throw new Error("La copia contiene registros incompletos o con fechas y valores inválidos.");
  }
  state.workouts = validWorkouts.map(item => ({
    id: typeof item.id === "string" ? item.id.slice(0, 80) : crypto.randomUUID(),
    date: item.date,
    name: typeof item.name === "string" ? item.name.slice(0, 120) : "Entrenamiento",
    goal: typeof item.goal === "string" ? item.goal.slice(0, 120) : "",
    sportId: typeof item.sportId === "string" ? item.sportId.slice(0, 40) : "",
    sportName: typeof item.sportName === "string" ? item.sportName.slice(0, 80) : "",
    duration: Number.isFinite(Number(item.duration)) ? Math.max(0, Math.min(1440, Number(item.duration))) : 0,
    exerciseCount: Number.isFinite(Number(item.exerciseCount)) ? Math.max(0, Math.min(100, Number(item.exerciseCount))) : 0,
    demo: item.demo === true
  })).slice(-500);
  state.weightLog = validWeights.map(item => ({
    id: typeof item.id === "string" ? item.id.slice(0, 80) : crypto.randomUUID(),
    date: item.date,
    weight: Number(Number(item.weight).toFixed(1)),
    demo: item.demo === true
  })).slice(-500);
  const safeRoutine = item => ({
    id: typeof item.id === "string" ? item.id.slice(0, 80) : crypto.randomUUID(),
    name: item.name.slice(0, 120),
    sportId: typeof item.sportId === "string" ? item.sportId.slice(0, 40) : "",
    goal: typeof item.goal === "string" ? item.goal.slice(0, 120) : "",
    level: typeof item.level === "string" ? item.level.slice(0, 30) : "Principiante",
    minutes: Number.isFinite(Number(item.minutes)) ? Math.max(1, Math.min(240, Number(item.minutes))) : 20,
    exerciseIds: item.exerciseIds.filter(id => typeof id === "string").slice(0, 30),
    demo: item.demo === true
  });
  state.routines = validRoutines.map(safeRoutine).slice(-30);
  state.completedDates = validCompletedDates.slice(-500);
  if (value.currentRoutine !== undefined && value.currentRoutine !== null) {
    if (typeof value.currentRoutine !== "object" || typeof value.currentRoutine.name !== "string" || !Array.isArray(value.currentRoutine.exerciseIds) || !value.currentRoutine.exerciseIds.every(id => typeof id === "string")) throw new Error("La rutina seleccionada de la copia no es válida.");
    state.currentRoutine = safeRoutine(value.currentRoutine);
  }
  if (typeof value.createdAt === "string") state.createdAt = value.createdAt;
  return state;
}

export function exportState(state) {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `onny-coach-copia-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export { STORAGE_KEY };
