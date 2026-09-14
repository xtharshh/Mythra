// i18n — the game speaks the explorer's language (nav, gates, tutorial).
// World content itself stays as-authored (AI/user tales aren't translated).
// Dictionaries live here; components re-render on the `mythra-lang` event.
import { useEffect, useState } from "react";

export type LangId = "en" | "hi" | "es" | "fr" | "de" | "pt";

export const LANGS: { id: LangId; label: string }[] = [
  { id: "en", label: "English" },
  { id: "hi", label: "हिन्दी" },
  { id: "es", label: "Español" },
  { id: "fr", label: "Français" },
  { id: "de", label: "Deutsch" },
  { id: "pt", label: "Português" },
];

export interface TutStep {
  reel: string;
  title: string;
  text: string;
  controls: string;
}

interface Dict {
  chrome: Record<string, string>;
  steps: TutStep[];
}

const EN: Dict = {
  chrome: {
    "nav.dossier": "Dossier",
    "nav.archive": "Archive",
    "nav.surface": "Surface",
    "nav.planner": "Planner",
    "nav.control": "Control",
    "nav.signin": "Sign in",
    "nav.online": "Online",
    "nav.offline": "Offline",
    "nav.tutorial": "Tutorial",
    "nav.coffee": "Coffee",
    "nav.language": "Language",
    "nav.modeTitle": "Switch offline / online mode",
    "nav.tutTitle": "Replay the cinematic field manual",
    "entry.kicker": "Welcome to Mythio · first descent",
    "entry.titleA": "How do you",
    "entry.titleB": "fly?",
    "entry.sub": "Solo expedition on this machine — or online party with Discord sign-in, races, and shared skies.",
    "entry.offline": "Play offline",
    "entry.online": "Play online",
    "entry.offHint": "offline = solo + local saves",
    "entry.onHint": "online = Discord sign-in + races + leaderboard",
    "entry.close": "Close",
    "login.kicker": "Explorer sign-in · no password",
    "login.title": "File under your name",
    "login.sub": "Enter your email, confirm the 6-digit code, and progress saves + checkpoints file under you instead of guest.",
    "login.email": "Email",
    "login.send": "Send code",
    "login.sending": "Sending…",
    "login.cancel": "Cancel",
    "login.code": "6-digit code",
    "login.verify": "Verify + sign in",
    "login.resend": "Resend",
    "login.skip": "or skip the code —",
    "login.discord": "Sign in with Discord",
    "login.retry": "Retry connection",
    "login.offlineNote": "Discord sign-in needs the API online — play offline, or start it.",
    "t.skip": "Skip reel ✕",
    "t.back": "◂ Back",
    "t.next": "Next ▸",
    "t.begin": "▼ Begin descent",
    "t.narrate": "🔊 Narrate",
    "t.replay": "Replay anytime: navbar → Tutorial",
    "t.reel": "field manual",
    "gate.pill": "⚠ priority transmission",
    "gate.kicker": "Handheld detected · suit systems limited",
    "gate.titleA": "Fly this on",
    "gate.titleB": "desktop.",
    "gate.text": "Explorer, your rig is handheld — the Surface needs a PC browser, a real keyboard, and room to breathe. Send this link to your desktop, then descend in full.",
    "gate.keys": "WASD · mouse-look · E — a touch screen can't fly this",
    "gate.copy": "Copy PC link",
    "gate.copied": "Link copied",
    "gate.continue": "Continue anyway",
    "gate.soon": "Desktop expedition app: in the hangar — this notice lifts for the session.",
  },
  steps: [
    { reel: "Briefing · what this is", title: "You are the solver.", text: "Mythio forges any story into a walkable world. This colony went silent on Sol 442 — walk it, read it, fix it, and decide what Earth hears.", controls: "Watch · listen · then take the controls" },
    { reel: "Lesson 01 · move", title: "Boots on dust.", text: "WASD walks the surface. Hold Shift to sprint across the ridge, Space to jump the debris. Your explorer is always visible in third person.", controls: "WASD move · Shift sprint · Space jump" },
    { reel: "Lesson 02 · look", title: "Eyes up, solver.", text: "Drag the mouse to look around the colony. Press V to swap between third person and your own visor — first person sees what you see.", controls: "Drag look · V camera" },
    { reel: "Lesson 03 · touch", title: "Everything answers.", text: "Aim the reticle at anything glowing — rover, terminal, scrap, survivor — and press E (or click) to inspect, collect, talk, or repair it.", controls: "Aim + E interact · click works too" },
    { reel: "Lesson 04 · solve", title: "Follow the evidence.", text: "Missions track in the side panel, clues file into your journal, and locked hatches open on puzzle answers. Stuck? Every puzzle carries hints on the radio.", controls: "Missions · Journal · Hints" },
    { reel: "Lesson 05 · fly", title: "Earn the sky.", text: "Salvage what the colony left behind. Find the flight-suit locker and the sky opens: F toggles thrusters, Space climbs, C dives.", controls: "F fly · Space up · C down" },
    { reel: "Lesson 06 · keep", title: "Never lose a run.", text: "Saves and named checkpoints file under your login — per explorer, always. Open a race room to solve against friends, live, in scenario suits.", controls: "Menu → Save · Checkpoints · Invite solvers" },
  ],
};

const HI: Dict = {
  chrome: {
    "nav.dossier": "डोज़ियर",
    "nav.archive": "अभिलेख",
    "nav.surface": "सतह",
    "nav.planner": "योजनाकार",
    "nav.control": "नियंत्रण",
    "nav.signin": "साइन इन",
    "nav.online": "ऑनलाइन",
    "nav.offline": "ऑफलाइन",
    "nav.tutorial": "ट्यूटोरियल",
    "nav.coffee": "कॉफ़ी",
    "nav.language": "भाषा",
    "nav.modeTitle": "ऑफलाइन / ऑनलाइन मोड बदलें",
    "nav.tutTitle": "फील्ड मैनुअल फिर से देखें",
    "entry.kicker": "Mythio में स्वागत · पहली उड़ान",
    "entry.titleA": "आप कैसे",
    "entry.titleB": "उड़ेंगे?",
    "entry.sub": "इस मशीन पर अकेला अभियान — या Discord साइन-इन, रेस और साझा आसमान के साथ ऑनलाइन पार्टी।",
    "entry.offline": "ऑफलाइन खेलें",
    "entry.online": "ऑनलाइन खेलें",
    "entry.offHint": "ऑफलाइन = अकेले + स्थानीय सेव",
    "entry.onHint": "ऑनलाइन = Discord साइन-इन + रेस + लीडरबोर्ड",
    "entry.close": "बंद करें",
    "login.kicker": "एक्सप्लोरर साइन-इन · बिना पासवर्ड",
    "login.title": "अपने नाम से दर्ज करें",
    "login.sub": "अपना ईमेल लिखें, 6 अंकों का कोड पक्का करें, और प्रगति अतिथि के बजाय आपके नाम से सहेजेगी।",
    "login.email": "ईमेल",
    "login.send": "कोड भेजें",
    "login.sending": "भेज रहे हैं…",
    "login.cancel": "रद्द करें",
    "login.code": "6 अंकों का कोड",
    "login.verify": "सत्यापित + साइन इन",
    "login.resend": "फिर भेजें",
    "login.skip": "या कोड छोड़ें —",
    "login.discord": "Discord से साइन इन",
    "login.retry": "फिर से जोड़ें",
    "login.offlineNote": "Discord साइन-इन के लिए API ऑनलाइन चाहिए — ऑफलाइन खेलें, या शुरू करें।",
    "t.skip": "रील छोड़ें ✕",
    "t.back": "◂ पीछे",
    "t.next": "आगे ▸",
    "t.begin": "▼ उतरना शुरू करें",
    "t.narrate": "🔊 सुनें",
    "t.replay": "कभी भी दोहराएं: नेवबार → ट्यूटोरियल",
    "t.reel": "फील्ड मैनुअल",
    "gate.pill": "⚠ प्राथमिकता संदेश",
    "gate.kicker": "हैंडहेल्ड मिला · सूट सीमित",
    "gate.titleA": "इसे इस पर उड़ाएं",
    "gate.titleB": "डेस्कटॉप।",
    "gate.text": "एक्सप्लोरर, आपका यंत्र हाथ का है — सतह को PC ब्राउज़र, असली कीबोर्ड और खुली जगह चाहिए। यह लिंक अपने डेस्कटॉप पर भेजें, फिर पूरी तरह उतरें।",
    "gate.keys": "WASD · माउस-दृष्टि · E — टच स्क्रीन यह नहीं उड़ा सकती",
    "gate.copy": "PC लिंक कॉपी करें",
    "gate.copied": "लिंक कॉपी हुआ",
    "gate.continue": "वैसे भी जारी रखें",
    "gate.soon": "डेस्कटॉप अभियान ऐप: हैंगर में — यह सूचना सत्र भर के लिए हटेगी।",
  },
  steps: [
    { reel: "ब्रीफिंग · यह क्या है", title: "आप ही हलकर्ता हैं।", text: "Mythio हर कहानी को चलने वाली दुनिया बनाता है। यह कॉलोनी Sol 442 पर खामोश हुई — चलें, पढ़ें, ठीक करें, और तय करें कि पृथ्वी क्या सुनेगी।", controls: "देखें · सुनें · फिर कमान संभालें" },
    { reel: "पाठ 01 · चलना", title: "धूल पर कदम।", text: "WASD से सतह पर चलें। पर्वत पार दौड़ने के लिए Shift दबाएं, मलबे पर कूदने के लिए Space। आपका एक्सप्लोरर हमेशा तीसरे व्यक्ति में दिखता है।", controls: "WASD चलना · Shift दौड़ · Space कूद" },
    { reel: "पाठ 02 · देखना", title: "नज़र ऊपर, हलकर्ता।", text: "कॉलोनी में देखने के लिए माउस घसीटें। तीसरे व्यक्ति और अपने वाइज़र के बीच बदलने के लिए V दबाएं।", controls: "घसीटकर देखें · V कैमरा" },
    { reel: "पाठ 03 · छूना", title: "हर चीज़ जवाब देती है।", text: "चमकती चीज़ पर निशाना लगाएं — रोवर, टर्मिनल, स्क्रैप — और निरीक्षण, संग्रह या मरम्मत के लिए E दबाएं (या क्लिक करें)।", controls: "निशाना + E · क्लिक भी चलेगा" },
    { reel: "पाठ 04 · सुलझाना", title: "सबूत का पीछा करें।", text: "मिशन साइड पैनल में, सुराग जर्नल में। बंद दरवाज़े पहेली के जवाब से खुलते हैं। अटके? हर पहेली में रेडियो पर संकेत हैं।", controls: "मिशन · जर्नल · संकेत" },
    { reel: "पाठ 05 · उड़ना", title: "आसमान कमाएं।", text: "कॉलोनी का छोड़ा सामान बटोरें। फ्लाइट-सूट लॉकर खोजें और आसमान खुल जाएगा: F से थ्रस्टर, Space से ऊपर, C से नीचे।", controls: "F उड़ान · Space ऊपर · C नीचे" },
    { reel: "पाठ 06 · बचाना", title: "कोई रन न खोएं।", text: "सेव और चेकपॉइंट आपके लॉगिन के नाम — हमेशा। दोस्तों से रेस के लिए रेस रूम खोलें।", controls: "मेनू → सेव · चेकपॉइंट · सॉल्वर बुलाएं" },
  ],
};

const ES: Dict = {
  chrome: {
    "nav.dossier": "Dosier",
    "nav.archive": "Archivo",
    "nav.surface": "Superficie",
    "nav.planner": "Planificador",
    "nav.control": "Control",
    "nav.signin": "Entrar",
    "nav.online": "En línea",
    "nav.offline": "Sin conexión",
    "nav.tutorial": "Tutorial",
    "nav.coffee": "Café",
    "nav.language": "Idioma",
    "nav.modeTitle": "Cambiar modo sin conexión / en línea",
    "nav.tutTitle": "Ver el manual de campo",
    "entry.kicker": "Bienvenido a Mythio · primer descenso",
    "entry.titleA": "¿Cómo quieres",
    "entry.titleB": "volar?",
    "entry.sub": "Expedición en solitario en esta máquina — o fiesta en línea con Discord, carreras y cielos compartidos.",
    "entry.offline": "Jugar sin conexión",
    "entry.online": "Jugar en línea",
    "entry.offHint": "sin conexión = solo + guardados locales",
    "entry.onHint": "en línea = Discord + carreras + tabla",
    "entry.close": "Cerrar",
    "login.kicker": "Acceso de explorador · sin contraseña",
    "login.title": "Registra tu nombre",
    "login.sub": "Escribe tu correo, confirma el código de 6 dígitos, y el progreso se guardará a tu nombre.",
    "login.email": "Correo",
    "login.send": "Enviar código",
    "login.sending": "Enviando…",
    "login.cancel": "Cancelar",
    "login.code": "Código de 6 dígitos",
    "login.verify": "Verificar y entrar",
    "login.resend": "Reenviar",
    "login.skip": "u omite el código —",
    "login.discord": "Entrar con Discord",
    "login.retry": "Reintentar",
    "login.offlineNote": "Discord necesita la API en línea — juega sin conexión, o iníciala.",
    "t.skip": "Saltar cinta ✕",
    "t.back": "◂ Atrás",
    "t.next": "Siguiente ▸",
    "t.begin": "▼ Comenzar descenso",
    "t.narrate": "🔊 Narrar",
    "t.replay": "Repítelo: barra → Tutorial",
    "t.reel": "manual de campo",
    "gate.pill": "⚠ transmisión prioritaria",
    "gate.kicker": "Móvil detectado · traje limitado",
    "gate.titleA": "Vuela esto en",
    "gate.titleB": "escritorio.",
    "gate.text": "Explorador, tu equipo es de mano — la Superficie necesita un navegador de PC, teclado real y espacio. Envía este enlace a tu escritorio y desciende completo.",
    "gate.keys": "WASD · mirar con ratón · E — el táctil no vuela",
    "gate.copy": "Copiar enlace PC",
    "gate.copied": "Enlace copiado",
    "gate.continue": "Continuar igual",
    "gate.soon": "App de escritorio: en el hangar — este aviso se levanta por la sesión.",
  },
  steps: [
    { reel: "Informe · qué es esto", title: "Tú eres quien resuelve.", text: "Mythio forja cualquier historia en un mundo caminable. Esta colonia calló en el Sol 442 — camínala, léela, arréglala y decide qué oye la Tierra.", controls: "Mira · escucha · toma los mandos" },
    { reel: "Lección 01 · moverse", title: "Botas en el polvo.", text: "WASD camina la superficie. Shift para correr por la cresta, Espacio para saltar escombros. Tu explorador siempre se ve en tercera persona.", controls: "WASD moverse · Shift correr · Espacio saltar" },
    { reel: "Lección 02 · mirar", title: "Vista al frente.", text: "Arrastra el ratón para mirar la colonia. V cambia entre tercera persona y tu visor.", controls: "Arrastrar mirar · V cámara" },
    { reel: "Lección 03 · tocar", title: "Todo responde.", text: "Apunta a lo que brille — rover, terminal, chatarra — y pulsa E (o clic) para inspeccionar, recoger, hablar o reparar.", controls: "Apunta + E · el clic vale" },
    { reel: "Lección 04 · resolver", title: "Sigue la evidencia.", text: "Misiones en el panel, pistas en tu diario, escotillas que abren con respuestas. ¿Atascado? Cada puzle trae pistas por radio.", controls: "Misiones · Diario · Pistas" },
    { reel: "Lección 05 · volar", title: "Gana el cielo.", text: "Recupera lo que dejó la colonia. Halla el traje de vuelo y el cielo se abre: F reactores, Espacio subir, C bajar.", controls: "F volar · Espacio subir · C bajar" },
    { reel: "Lección 06 · guardar", title: "Nunca pierdas nada.", text: "Guardados y puntos de control a tu nombre — siempre. Abre una sala de carrera contra amigos, en vivo.", controls: "Menú → Guardar · Puntos · Invitar" },
  ],
};

const FR: Dict = {
  chrome: {
    "nav.dossier": "Dossier",
    "nav.archive": "Archives",
    "nav.surface": "Surface",
    "nav.planner": "Planificateur",
    "nav.control": "Contrôle",
    "nav.signin": "Connexion",
    "nav.online": "En ligne",
    "nav.offline": "Hors ligne",
    "nav.tutorial": "Tutoriel",
    "nav.coffee": "Café",
    "nav.language": "Langue",
    "nav.modeTitle": "Changer de mode hors ligne / en ligne",
    "nav.tutTitle": "Revoir le manuel de terrain",
    "entry.kicker": "Bienvenue sur Mythio · première descente",
    "entry.titleA": "Comment veux-tu",
    "entry.titleB": "voler ?",
    "entry.sub": "Expédition solo sur cette machine — ou partie en ligne avec Discord, courses et ciels partagés.",
    "entry.offline": "Jouer hors ligne",
    "entry.online": "Jouer en ligne",
    "entry.offHint": "hors ligne = solo + sauvegardes locales",
    "entry.onHint": "en ligne = Discord + courses + classement",
    "entry.close": "Fermer",
    "login.kicker": "Connexion explorateur · sans mot de passe",
    "login.title": "Dossier à ton nom",
    "login.sub": "Entre ton e-mail, confirme le code à 6 chiffres, et ta progression sera classée à ton nom.",
    "login.email": "E-mail",
    "login.send": "Envoyer le code",
    "login.sending": "Envoi…",
    "login.cancel": "Annuler",
    "login.code": "Code à 6 chiffres",
    "login.verify": "Vérifier + entrer",
    "login.resend": "Renvoyer",
    "login.skip": "ou saute le code —",
    "login.discord": "Se connecter avec Discord",
    "login.retry": "Réessayer",
    "login.offlineNote": "Discord exige l'API en ligne — joue hors ligne, ou démarre-la.",
    "t.skip": "Sauter la bobine ✕",
    "t.back": "◂ Retour",
    "t.next": "Suivant ▸",
    "t.begin": "▼ Commencer la descente",
    "t.narrate": "🔊 Raconter",
    "t.replay": "Rejoue quand tu veux : barre → Tutoriel",
    "t.reel": "manuel de terrain",
    "gate.pill": "⚠ transmission prioritaire",
    "gate.kicker": "Mobile détecté · combinaison limitée",
    "gate.titleA": "Vole plutôt sur",
    "gate.titleB": "bureau.",
    "gate.text": "Explorateur, ton équipement tient en main — la Surface veut un navigateur PC, un vrai clavier et de l'espace. Envoie ce lien à ton bureau, puis descends en entier.",
    "gate.keys": "WASD · regard souris · E — le tactile ne vole pas",
    "gate.copy": "Copier le lien PC",
    "gate.copied": "Lien copié",
    "gate.continue": "Continuer quand même",
    "gate.soon": "App de bureau : au hangar — cet avis se lève pour la session.",
  },
  steps: [
    { reel: "Briefing · de quoi s'agit-il", title: "C'est toi qui résous.", text: "Mythio forge chaque histoire en monde praticable. Cette colonie s'est tue au Sol 442 — parcours-la, lis-la, répare-la, et décide ce que la Terre entendra.", controls: "Regarde · écoute · prends les commandes" },
    { reel: "Leçon 01 · bouger", title: "Bottes dans la poussière.", text: "WASD marche en surface. Shift pour sprinter sur la crête, Espace pour sauter les débris. Ton explorateur reste visible à la troisième personne.", controls: "WASD bouger · Shift courir · Espace sauter" },
    { reel: "Leçon 02 · regarder", title: "Yeux levés.", text: "Glisse la souris pour regarder la colonie. V bascule entre troisième personne et ta visière.", controls: "Glisser regarder · V caméra" },
    { reel: "Leçon 03 · toucher", title: "Tout répond.", text: "Vise ce qui brille — rover, terminal, ferraille — et appuie sur E (ou clique) pour inspecter, ramasser, parler ou réparer.", controls: "Viser + E · le clic marche aussi" },
    { reel: "Leçon 04 · résoudre", title: "Suis les preuves.", text: "Missions au panneau, indices au journal, trappes qui s'ouvrent aux réponses. Bloqué ? Chaque puzzle murmure des indices à la radio.", controls: "Missions · Journal · Indices" },
    { reel: "Leçon 05 · voler", title: "Gagne le ciel.", text: "Récupère ce que la colonie a laissé. Trouve le casier de vol et le ciel s'ouvre : F réacteurs, Espace monter, C descendre.", controls: "F voler · Espace monter · C descendre" },
    { reel: "Leçon 06 · garder", title: "Ne perds rien.", text: "Sauvegardes et points de contrôle à ton nom — toujours. Ouvre une salle de course contre tes amis, en direct.", controls: "Menu → Sauver · Points · Inviter" },
  ],
};

const DE: Dict = {
  chrome: {
    "nav.dossier": "Dossier",
    "nav.archive": "Archiv",
    "nav.surface": "Oberfläche",
    "nav.planner": "Planer",
    "nav.control": "Kontrolle",
    "nav.signin": "Anmelden",
    "nav.online": "Online",
    "nav.offline": "Offline",
    "nav.tutorial": "Tutorial",
    "nav.coffee": "Kaffee",
    "nav.language": "Sprache",
    "nav.modeTitle": "Offline-/Online-Modus wechseln",
    "nav.tutTitle": "Feldhandbuch erneut ansehen",
    "entry.kicker": "Willkommen bei Mythio · erster Abstieg",
    "entry.titleA": "Wie willst du",
    "entry.titleB": "fliegen?",
    "entry.sub": "Solo-Expedition auf dieser Maschine — oder Online-Party mit Discord, Rennen und geteiltem Himmel.",
    "entry.offline": "Offline spielen",
    "entry.online": "Online spielen",
    "entry.offHint": "offline = solo + lokale Saves",
    "entry.onHint": "online = Discord + Rennen + Bestenliste",
    "entry.close": "Schließen",
    "login.kicker": "Explorer-Login · ohne Passwort",
    "login.title": "Akte auf deinen Namen",
    "login.sub": "E-Mail eingeben, 6-stelligen Code bestätigen — Fortschritt wird auf dich gebucht, nicht auf Gast.",
    "login.email": "E-Mail",
    "login.send": "Code senden",
    "login.sending": "Sendet…",
    "login.cancel": "Abbrechen",
    "login.code": "6-stelliger Code",
    "login.verify": "Prüfen + anmelden",
    "login.resend": "Erneut senden",
    "login.skip": "oder Code überspringen —",
    "login.discord": "Mit Discord anmelden",
    "login.retry": "Erneut versuchen",
    "login.offlineNote": "Discord braucht die API online — spiel offline oder starte sie.",
    "t.skip": "Film überspringen ✕",
    "t.back": "◂ Zurück",
    "t.next": "Weiter ▸",
    "t.begin": "▼ Abstieg beginnen",
    "t.narrate": "🔊 Erzählen",
    "t.replay": "Jederzeit wieder: Leiste → Tutorial",
    "t.reel": "Feldhandbuch",
    "gate.pill": "⚠ Prioritätsfunk",
    "gate.kicker": "Handheld erkannt · Anzug begrenzt",
    "gate.titleA": "Flieg das lieber auf",
    "gate.titleB": "Desktop.",
    "gate.text": "Explorer, dein Gerät ist handlich — die Oberfläche braucht PC-Browser, echte Tastatur und Platz. Schick diesen Link an deinen Desktop und steig voll ein.",
    "gate.keys": "WASD · Mausblick · E — Touchscreen kann das nicht fliegen",
    "gate.copy": "PC-Link kopieren",
    "gate.copied": "Link kopiert",
    "gate.continue": "Trotzdem weiter",
    "gate.soon": "Desktop-App: im Hangar — dieser Hinweis gilt für die Sitzung.",
  },
  steps: [
    { reel: "Briefing · worum geht's", title: "Du bist der Löser.", text: "Mythio schmiedet jede Story in eine begehbare Welt. Diese Kolonie verstummte an Sol 442 — geh sie, lies sie, repariere sie und entscheide, was die Erde hört.", controls: "Schauen · hören · übernehmen" },
    { reel: "Lektion 01 · bewegen", title: "Stiefel im Staub.", text: "WASD geht über die Oberfläche. Shift zum Sprinten über den Grat, Leertaste zum Springen. Dein Explorer bleibt in Third-Person sichtbar.", controls: "WASD gehen · Shift Sprint · Space Sprung" },
    { reel: "Lektion 02 · schauen", title: "Blick hoch.", text: "Maus ziehen, um die Kolonie zu betrachten. V wechselt zwischen Third-Person und deinem Visier.", controls: "Ziehen schauen · V Kamera" },
    { reel: "Lektion 03 · berühren", title: "Alles antwortet.", text: "Ziele auf Glühendes — Rover, Terminal, Schrott — und drücke E (oder klicke) zum Inspizieren, Sammeln, Reden oder Reparieren.", controls: "Zielen + E · Klick geht auch" },
    { reel: "Lektion 04 · lösen", title: "Folg den Beweisen.", text: "Missionen im Panel, Hinweise im Journal, Luken öffnen auf Rätselantworten. Festgefahren? Jedes Puzzle funkt Hinweise.", controls: "Missionen · Journal · Hinweise" },
    { reel: "Lektion 05 · fliegen", title: "Verdien dir den Himmel.", text: "Berge, was die Kolonie ließ. Finde den Fluganzug-Schrank und der Himmel öffnet sich: F Schub, Space hoch, C runter.", controls: "F fliegen · Space hoch · C runter" },
    { reel: "Lektion 06 · behalten", title: "Verlier keinen Run.", text: "Saves und Checkpoints laufen auf deinen Namen — immer. Öffne einen Rennraum gegen Freunde, live.", controls: "Menü → Save · Checkpoints · Einladen" },
  ],
};

const PT: Dict = {
  chrome: {
    "nav.dossier": "Dossiê",
    "nav.archive": "Arquivo",
    "nav.surface": "Superfície",
    "nav.planner": "Planejador",
    "nav.control": "Controle",
    "nav.signin": "Entrar",
    "nav.online": "On-line",
    "nav.offline": "Off-line",
    "nav.tutorial": "Tutorial",
    "nav.coffee": "Café",
    "nav.language": "Idioma",
    "nav.modeTitle": "Trocar modo off-line / on-line",
    "nav.tutTitle": "Rever o manual de campo",
    "entry.kicker": "Bem-vindo ao Mythio · primeira descida",
    "entry.titleA": "Como você quer",
    "entry.titleB": "voar?",
    "entry.sub": "Expedição solo nesta máquina — ou festa on-line com Discord, corridas e céus partilhados.",
    "entry.offline": "Jogar off-line",
    "entry.online": "Jogar on-line",
    "entry.offHint": "off-line = solo + saves locais",
    "entry.onHint": "on-line = Discord + corridas + placar",
    "entry.close": "Fechar",
    "login.kicker": "Login de explorador · sem senha",
    "login.title": "Ficha em seu nome",
    "login.sub": "Digite seu e-mail, confirme o código de 6 dígitos, e o progresso fica no seu nome.",
    "login.email": "E-mail",
    "login.send": "Enviar código",
    "login.sending": "Enviando…",
    "login.cancel": "Cancelar",
    "login.code": "Código de 6 dígitos",
    "login.verify": "Verificar + entrar",
    "login.resend": "Reenviar",
    "login.skip": "ou pule o código —",
    "login.discord": "Entrar com Discord",
    "login.retry": "Tentar de novo",
    "login.offlineNote": "O Discord precisa da API on-line — jogue off-line, ou inicie-a.",
    "t.skip": "Pular rolo ✕",
    "t.back": "◂ Voltar",
    "t.next": "Avançar ▸",
    "t.begin": "▼ Começar descida",
    "t.narrate": "🔊 Narrar",
    "t.replay": "Reveja quando quiser: barra → Tutorial",
    "t.reel": "manual de campo",
    "gate.pill": "⚠ transmissão prioritária",
    "gate.kicker": "Móvel detectado · traje limitado",
    "gate.titleA": "Voe isto no",
    "gate.titleB": "desktop.",
    "gate.text": "Explorador, seu aparelho é de mão — a Superfície precisa de navegador de PC, teclado de verdade e espaço. Mande este link ao seu desktop e desça por inteiro.",
    "gate.keys": "WASD · olhar com mouse · E — o toque não voa",
    "gate.copy": "Copiar link PC",
    "gate.copied": "Link copiado",
    "gate.continue": "Continuar mesmo assim",
    "gate.soon": "App de desktop: no hangar — este aviso vale pela sessão.",
  },
  steps: [
    { reel: "Briefing · o que é isto", title: "Você é quem resolve.", text: "Mythio forja qualquer história num mundo caminhável. Esta colônia calou no Sol 442 — caminhe-a, leia-a, conserte-a e decida o que a Terra ouve.", controls: "Veja · ouça · assuma" },
    { reel: "Lição 01 · mover", title: "Botas na poeira.", text: "WASD anda na superfície. Shift para correr pela crista, Espaço para pular escombros. Seu explorador sempre visível em terceira pessoa.", controls: "WASD mover · Shift correr · Espaço pular" },
    { reel: "Lição 02 · olhar", title: "Olhos para cima.", text: "Arraste o mouse para olhar a colônia. V troca entre terceira pessoa e sua viseira.", controls: "Arrastar olhar · V câmera" },
    { reel: "Lição 03 · tocar", title: "Tudo responde.", text: "Mire no que brilha — rover, terminal, sucata — e prima E (ou clique) para inspecionar, coletar, falar ou reparar.", controls: "Mirar + E · clique vale" },
    { reel: "Lição 04 · resolver", title: "Siga a evidência.", text: "Missões no painel, pistas no diário, escotilhas que abrem com respostas. Travou? Todo puzzle traz dicas no rádio.", controls: "Missões · Diário · Dicas" },
    { reel: "Lição 05 · voar", title: "Conquiste o céu.", text: "Recupere o que a colônia deixou. Ache o armário do traje e o céu se abre: F propulsores, Espaço subir, C descer.", controls: "F voar · Espaço subir · C descer" },
    { reel: "Lição 06 · guardar", title: "Nunca perca nada.", text: "Saves e checkpoints no seu nome — sempre. Abra uma sala de corrida contra amigos, ao vivo.", controls: "Menu → Salvar · Pontos · Convidar" },
  ],
};

export const DICTS: Record<LangId, Dict> = { en: EN, hi: HI, es: ES, fr: FR, de: DE, pt: PT };

const LANG_KEY = "mythra-lang-v1";
export const LANG_EVENT = "mythra-lang";

export function getLang(): LangId {
  try {
    const raw = localStorage.getItem(LANG_KEY);
    if (raw === "hi" || raw === "es" || raw === "fr" || raw === "de" || raw === "pt") return raw;
  } catch {
    /* headless */
  }
  return "en";
}

export function setLang(id: LangId): void {
  try {
    localStorage.setItem(LANG_KEY, id);
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new Event(LANG_EVENT));
  } catch {
    /* headless */
  }
}

/** Translated chrome string (English → key fallback chain). */
export function t(key: string, lang?: LangId): string {
  const l = lang ?? getLang();
  return DICTS[l]?.chrome[key] ?? DICTS.en.chrome[key] ?? key;
}

/** Tutorial reels in the explorer's language. */
export function tutorialSteps(lang?: LangId): TutStep[] {
  const l = lang ?? getLang();
  return DICTS[l]?.steps ?? DICTS.en.steps;
}

export function useLang(): { lang: LangId; setLang: (l: LangId) => void } {
  const [lang, setLangState] = useState<LangId>(() => getLang());
  useEffect(() => {
    const onLang = () => setLangState(getLang());
    window.addEventListener(LANG_EVENT, onLang);
    return () => window.removeEventListener(LANG_EVENT, onLang);
  }, []);
  return {
    lang,
    setLang: (l: LangId) => {
      setLang(l);
      setLangState(l);
    },
  };
}
