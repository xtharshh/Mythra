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
    "nav.dossier": "Home",
    "nav.archive": "Stories",
    "nav.surface": "Play",
    "nav.planner": "Create",
    "nav.control": "Studio",
    "nav.what.dossier": "Home — start here",
    "nav.what.archive": "Browse and join every story",
    "nav.what.surface": "Play inside the 3D world",
    "nav.what.planner": "Make a new story with AI",
    "nav.what.control": "Manage your stories and reviews",
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
    { reel: "Start here · what this is", title: "You play inside stories.", text: "Mythio turns any story into a world you can walk through. Read clues, solve puzzles, finish missions, and decide how the tale ends.", controls: "No account needed to look around" },
    { reel: "Your 5 pages", title: "Five rooms, one game.", text: "Dossier is home. Archive holds every story. Surface is the 3D world you play in. Planner makes new stories. Control manages your stories and reviews.", controls: "The top bar takes you everywhere" },
    { reel: "Lesson 01 · move", title: "Walk with WASD.", text: "WASD walks you around. Hold Shift to run, Space to jump. You always see your explorer in front of you.", controls: "WASD move · Shift run · Space jump" },
    { reel: "Lesson 02 · look", title: "Drag to look.", text: "Hold the mouse and drag to look around. Press V to switch between seeing your explorer and seeing through your own eyes.", controls: "Drag look · V camera" },
    { reel: "Lesson 03 · touch", title: "Touch glowing things.", text: "Aim the circle at anything glowing — rover, screen, scrap, survivor — and press E (or click) to look at it, pick it up, talk, or fix it.", controls: "Aim + E interact · click works too" },
    { reel: "Lesson 04 · solve", title: "Follow the clues.", text: "Your jobs list on the side. Clues go in your journal. Locked doors open with puzzle answers. Stuck? Every puzzle gives hints.", controls: "Missions · Journal · Hints" },
    { reel: "Lesson 05 · fly", title: "Earn the sky.", text: "Collect what the story left behind. Find the flight suit and the sky opens: F for thrusters, Space to go up, C to come down.", controls: "F fly · Space up · C down" },
    { reel: "Account · your name", title: "Sign in once, keep everything.", text: "Pick Online and sign in with Discord or email. Then every save, checkpoint, key and rating is stored under your name.", controls: "Online → sign in → done" },
    { reel: "Friends · play together", title: "Race your friends.", text: "On the Surface, open Invite solvers to get a short link. Friends land in your story, appear in your sky, and race you on the speed board.", controls: "Invite → share link → race" },
    { reel: "Create · make stories", title: "Type a story, get a world.", text: "In the Planner, write a title and a short brief, pick an AI helper, and press Compile. Check the full preview, then Approve to play or Publish to share.", controls: "Title + brief → Compile → Approve" },
    { reel: "Grow · chapters", title: "Stories keep growing.", text: "On the Surface, Continue story adds your own clue, note, chapter or mission idea. The maker approves it — then it is part of the tale for everyone.", controls: "Write → submit → approved → chapter" },
    { reel: "Keep · never lose", title: "Your progress is safe.", text: "The Menu saves your run. Big moments save themselves as checkpoints. Voice reads stories aloud, and the mic takes your commands.", controls: "Menu → Save · sound · voice" },
  ],
};

const HI: Dict = {
  chrome: {
    "nav.dossier": "होम",
    "nav.archive": "कहानियाँ",
    "nav.surface": "खेलें",
    "nav.planner": "बनाएँ",
    "nav.control": "स्टूडियो",
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
    { reel: "शुरुआत · यह क्या है", title: "आप कहानियों के अंदर खेलते हैं।", text: "Mythio हर कहानी को चलने वाली दुनिया बनाता है। सुराग पढ़ें, पहेलियां सुलझाएं, काम पूरे करें, और कहानी का अंत तय करें।", controls: "देखने के लिए खाता नहीं चाहिए" },
    { reel: "आपके 5 पन्ने", title: "पांच कमरे, एक खेल।", text: "डोज़ियर घर है। अभिलेख में हर कहानी है। सतह वह 3D दुनिया है जिसमें आप खेलते हैं। योजनाकार नई कहानियां बनाता है। नियंत्रण आपकी कहानियां संभालता है।", controls: "ऊपर की पट्टी हर जगह ले जाती है" },
    { reel: "पाठ 01 · चलना", title: "WASD से चलें।", text: "WASD से घूमें। दौड़ने के लिए Shift दबाएं, कूदने के लिए Space। आपका एक्सप्लोरर हमेशा सामने दिखता है।", controls: "WASD चलना · Shift दौड़ · Space कूद" },
    { reel: "पाठ 02 · देखना", title: "देखने के लिए घसीटें।", text: "माउस दबाकर घसीटने से देखें। अपने एक्सप्लोरर को देखने और अपनी आंखों से देखने के बीच V से बदलें।", controls: "घसीटकर देखें · V कैमरा" },
    { reel: "पाठ 03 · छूना", title: "चमकती चीज़ें छुएं।", text: "चमकती चीज़ पर निशाना लगाएं और E दबाएं (या क्लिक करें) — देखें, उठाएं, बात करें या ठीक करें।", controls: "निशाना + E · क्लिक भी चलेगा" },
    { reel: "पाठ 04 · सुलझाना", title: "सुरागों पर चलें।", text: "आपके काम बगल में दिखते हैं। सुराग जर्नल में जाते हैं। बंद दरवाज़े पहेली के जवाब से खुलते हैं। हर पहेली में संकेत मिलते हैं।", controls: "काम · जर्नल · संकेत" },
    { reel: "पाठ 05 · उड़ना", title: "आसमान कमाएं।", text: "कहानी का छोड़ा सामान बटोरें। फ्लाइट सूट खोजें और आसमान खुल जाएगा: F से थ्रस्टर, Space से ऊपर, C से नीचे।", controls: "F उड़ान · Space ऊपर · C नीचे" },
    { reel: "खाता · आपका नाम", title: "एक बार साइन इन, सब सुरक्षित।", text: "Online चुनें और Discord या ईमेल से साइन इन करें। फिर हर सेव और चेकपॉइंट आपके नाम से सहेजेगा।", controls: "Online → साइन इन → हो गया" },
    { reel: "दोस्त · साथ खेलें", title: "दोस्तों से रेस करें।", text: "सतह पर Invite solvers खोलें और छोटा लिंक भेजें। दोस्त आपकी कहानी में उतरेंगे, आपके आसमान में दिखेंगे और स्पीड बोर्ड पर रेस करेंगे।", controls: "बुलाएं → लिंक भेजें → रेस" },
    { reel: "बनाएं · कहानियां गढ़ें", title: "शीर्षक लिखें, दुनिया पाएं।", text: "योजनाकार में शीर्षक और छोटा ब्यौरा लिखें, AI सहायक चुनें और Compile दबाएं। पूरी झलक देखें, फिर Approve से खेलें या Publish से बांटें।", controls: "शीर्षक + ब्यौरा → Compile → Approve" },
    { reel: "बढ़ाएं · अध्याय", title: "कहानियां बढ़ती रहती हैं।", text: "सतह पर Continue story से अपना सुराग, नोट, अध्याय या मिशन जोड़ें। निर्माता मंज़ूर करे तो वह सबकी कहानी का हिस्सा बन जाता है।", controls: "लिखें → भेजें → मंज़ूर → अध्याय" },
    { reel: "बचाएं · कभी न खोएं", title: "आपकी प्रगति सुरक्षित है।", text: "Menu से रन सहेजें। बड़ी घड़ियां खुद चेकपॉइंट बन जाती हैं। आवाज़ कहानियां सुनाती है, माइक आपके आदेश लेता है।", controls: "Menu → सेव · आवाज़" },
  ],
};

const ES: Dict = {
  chrome: {
    "nav.dossier": "Inicio",
    "nav.archive": "Historias",
    "nav.surface": "Jugar",
    "nav.planner": "Crear",
    "nav.control": "Estudio",
    "nav.what.dossier": "Home — start here",
    "nav.what.archive": "Browse and join every story",
    "nav.what.surface": "Play inside the 3D world",
    "nav.what.planner": "Make a new story with AI",
    "nav.what.control": "Manage your stories and reviews",
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
    { reel: "Empieza aquí · qué es esto", title: "Juegas dentro de historias.", text: "Mythio convierte cualquier historia en un mundo que puedes caminar. Lee pistas, resuelve puzles, termina misiones y decide el final.", controls: "Sin cuenta para mirar" },
    { reel: "Tus 5 páginas", title: "Cinco salas, un juego.", text: "Dosier es casa. Archivo guarda cada historia. Superficie es el mundo 3D. Planificador crea historias. Control gestiona las tuyas.", controls: "La barra te lleva a todo" },
    { reel: "Lección 01 · moverse", title: "Camina con WASD.", text: "WASD te mueve. Mantén Shift para correr, Espacio para saltar. Siempre ves a tu explorador delante de ti.", controls: "WASD moverse · Shift correr · Espacio saltar" },
    { reel: "Lección 02 · mirar", title: "Arrastra para mirar.", text: "Mantén el ratón y arrastra para mirar. V cambia entre ver a tu explorador y ver con tus ojos.", controls: "Arrastrar mirar · V cámara" },
    { reel: "Lección 03 · tocar", title: "Toca lo que brilla.", text: "Apunta a lo que brille y pulsa E (o clic) para mirar, recoger, hablar o reparar.", controls: "Apunta + E · el clic vale" },
    { reel: "Lección 04 · resolver", title: "Sigue las pistas.", text: "Tus trabajos salen al lado. Las pistas van a tu diario. Las puertas abren con respuestas. Cada puzle da pistas.", controls: "Trabajos · Diario · Pistas" },
    { reel: "Lección 05 · volar", title: "Gana el cielo.", text: "Recoge lo que dejó la historia. Halla el traje de vuelo: F reactores, Espacio subir, C bajar.", controls: "F volar · Espacio subir · C bajar" },
    { reel: "Cuenta · tu nombre", title: "Entra una vez, guarda todo.", text: "Elige En línea y entra con Discord o correo. Cada guardado y punto queda a tu nombre.", controls: "En línea → entrar → listo" },
    { reel: "Amigos · juntos", title: "Corre con amigos.", text: "En la Superficie abre Invitar y manda el enlace corto. Tus amigos caen en tu historia, se ven en tu cielo y corren en el tablero.", controls: "Invitar → mandar → correr" },
    { reel: "Crear · haz historias", title: "Escribe y recibe un mundo.", text: "En el Planificador escribe título y resumen, elige ayudante IA y pulsa Compilar. Revisa todo, Aprueba para jugar o Publica para compartir.", controls: "Título + resumen → Compilar" },
    { reel: "Crecer · capítulos", title: "Las historias crecen.", text: "Con Continuar añades pista, nota, capítulo o misión. El creador la aprueba y pasa a ser de la historia para todos.", controls: "Escribir → enviar → capítulo" },
    { reel: "Guardar · sin pérdidas", title: "Tu progreso a salvo.", text: "El Menú guarda tu partida. Los grandes momentos se guardan solos. La voz lee cuentos y el micro obedece.", controls: "Menú → Guardar · voz" },
  ],
};

const FR: Dict = {
  chrome: {
    "nav.dossier": "Accueil",
    "nav.archive": "Histoires",
    "nav.surface": "Jouer",
    "nav.planner": "Créer",
    "nav.control": "Studio",
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
    { reel: "Ici · c'est quoi", title: "Tu joues dans des histoires.", text: "Mythio change chaque histoire en monde à parcourir. Lis les indices, résous les puzzles, finis les missions, choisis la fin.", controls: "Pas de compte pour regarder" },
    { reel: "Tes 5 pages", title: "Cinq salles, un jeu.", text: "Dossier c'est la maison. Archives garde chaque histoire. Surface est le monde 3D. Planificateur crée. Contrôle gère tes histoires.", controls: "La barre mène partout" },
    { reel: "Leçon 01 · bouger", title: "Marche avec WASD.", text: "WASD te déplace. Shift pour courir, Espace pour sauter. Tu vois toujours ton explorateur devant toi.", controls: "WASD bouger · Shift courir · Espace sauter" },
    { reel: "Leçon 02 · regarder", title: "Glisse pour regarder.", text: "Maintiens la souris et glisse pour regarder. V passe de ton explorateur à tes propres yeux.", controls: "Glisser regarder · V caméra" },
    { reel: "Leçon 03 · toucher", title: "Touche ce qui brille.", text: "Vise ce qui brille et appuie sur E (ou clique) pour regarder, prendre, parler ou réparer.", controls: "Viser + E · le clic marche" },
    { reel: "Leçon 04 · résoudre", title: "Suis les indices.", text: "Tes tâches s'affichent à côté. Les indices vont au journal. Les portes s'ouvrent aux réponses. Chaque puzzle donne des indices.", controls: "Tâches · Journal · Indices" },
    { reel: "Leçon 05 · voler", title: "Gagne le ciel.", text: "Ramasse ce que l'histoire a laissé. Trouve la combinaison de vol : F réacteurs, Espace monter, C descendre.", controls: "F voler · Espace monter · C descendre" },
    { reel: "Compte · ton nom", title: "Connecte-toi, tout est gardé.", text: "Choisis En ligne, connecte-toi avec Discord ou e-mail. Chaque sauvegarde est à ton nom.", controls: "En ligne → connexion → fini" },
    { reel: "Amis · ensemble", title: "Fais la course.", text: "Sur la Surface, ouvre Inviter et envoie le lien court. Tes amis tombent dans ton histoire et courent au tableau.", controls: "Inviter → envoyer → course" },
    { reel: "Créer · fais des histoires", title: "Écris, reçois un monde.", text: "Au Planificateur, écris titre et résumé, choisis une IA, appuie Compiler. Vérifie tout, Approuve pour jouer, Publie pour partager.", controls: "Titre + résumé → Compiler" },
    { reel: "Grandir · chapitres", title: "Les histoires grandissent.", text: "Avec Continuer tu ajoutes indice, note, chapitre ou mission. Le créateur approuve et ça devient l'histoire pour tous.", controls: "Écrire → envoyer → chapitre" },
    { reel: "Garder · sans perte", title: "Ton progrès est sauf.", text: "Le Menu sauve ta partie. Les grands moments se sauvent seuls. La voix lit, le micro obéit.", controls: "Menu → Sauver · voix" },
  ],
};

const DE: Dict = {
  chrome: {
    "nav.dossier": "Start",
    "nav.archive": "Geschichten",
    "nav.surface": "Spielen",
    "nav.planner": "Erstellen",
    "nav.control": "Studio",
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
    { reel: "Start · was ist das", title: "Du spielst in Geschichten.", text: "Mythio macht aus jeder Story eine begehbare Welt. Lies Hinweise, löse Rätsel, beende Missionen und bestimme das Ende.", controls: "Kein Konto zum Schauen nötig" },
    { reel: "Deine 5 Seiten", title: "Fünf Räume, ein Spiel.", text: "Dossier ist Zuhause. Archiv hält jede Story. Surface ist die 3D-Welt. Planer baut Stories. Kontrolle verwaltet deine.", controls: "Die Leiste führt überall hin" },
    { reel: "Lektion 01 · gehen", title: "Geh mit WASD.", text: "WASD bewegt dich. Shift zum Rennen, Leertaste zum Springen. Du siehst deinen Explorer immer vor dir.", controls: "WASD gehen · Shift Rennen · Space Sprung" },
    { reel: "Lektion 02 · schauen", title: "Ziehen zum Schauen.", text: "Maus halten und ziehen zum Umsehen. V wechselt zwischen Explorer-Ansicht und deinen Augen.", controls: "Ziehen schauen · V Kamera" },
    { reel: "Lektion 03 · berühren", title: "Berühr Glühendes.", text: "Ziele auf Glühendes und drücke E (oder klicke) zum Ansehen, Nehmen, Reden oder Reparieren.", controls: "Zielen + E · Klick geht auch" },
    { reel: "Lektion 04 · lösen", title: "Folg den Hinweisen.", text: "Deine Jobs stehen daneben. Hinweise landen im Journal. Türen öffnen auf Rätselantworten. Jedes Puzzle gibt Tipps.", controls: "Jobs · Journal · Tipps" },
    { reel: "Lektion 05 · fliegen", title: "Verdien den Himmel.", text: "Sammle, was die Story ließ. Finde den Fluganzug: F Schub, Space hoch, C runter.", controls: "F fliegen · Space hoch · C runter" },
    { reel: "Konto · dein Name", title: "Einmal anmelden, alles bleibt.", text: "Wähle Online, melde dich mit Discord oder E-Mail an. Jeder Save läuft auf deinen Namen.", controls: "Online → anmelden → fertig" },
    { reel: "Freunde · zusammen", title: "Renne gegen Freunde.", text: "Auf der Surface Einladen öffnen und Kurzlink schicken. Freunde landen in deiner Story und racen auf dem Board.", controls: "Einladen → schicken → racen" },
    { reel: "Bauen · Stories machen", title: "Titel rein, Welt raus.", text: "Im Planer Titel und Kurztext schreiben, KI-Helfer wählen, Kompilieren drücken. Alles prüfen, Freigeben zum Spielen oder Veröffentlichen zum Teilen.", controls: "Titel + Text → Kompilieren" },
    { reel: "Wachsen · Kapitel", title: "Stories wachsen weiter.", text: "Mit Fortsetzen fügst du Hinweis, Notiz, Kapitel oder Mission hinzu. Der Maker bestätigt — dann gehört es allen.", controls: "Schreiben → senden → Kapitel" },
    { reel: "Behalten · nichts verlieren", title: "Dein Fortschritt ist sicher.", text: "Das Menü speichert deinen Run. Große Momente speichern sich selbst. Stimme liest vor, Mikro gehorcht.", controls: "Menü → Save · Stimme" },
  ],
};

const PT: Dict = {
  chrome: {
    "nav.dossier": "Início",
    "nav.archive": "Histórias",
    "nav.surface": "Jogar",
    "nav.planner": "Criar",
    "nav.control": "Estúdio",
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
    { reel: "Começo · o que é", title: "Você joga dentro de histórias.", text: "Mythio vira qualquer história num mundo que se caminha. Leia pistas, resolva puzzles, termine missões e escolha o final.", controls: "Sem conta para olhar" },
    { reel: "Suas 5 páginas", title: "Cinco salas, um jogo.", text: "Dossiê é casa. Arquivo guarda cada história. Superfície é o mundo 3D. Planejador cria. Controle cuida das suas.", controls: "A barra leva a tudo" },
    { reel: "Lição 01 · mover", title: "Ande com WASD.", text: "WASD move você. Segure Shift para correr, Espaço para pular. Você sempre vê seu explorador na frente.", controls: "WASD mover · Shift correr · Espaço pular" },
    { reel: "Lição 02 · olhar", title: "Arraste para olhar.", text: "Segure o mouse e arraste para olhar. V troca entre ver seu explorador e ver com seus olhos.", controls: "Arrastar olhar · V câmera" },
    { reel: "Lição 03 · tocar", title: "Toque no que brilha.", text: "Mire no que brilha e prima E (ou clique) para olhar, pegar, falar ou consertar.", controls: "Mirar + E · clique vale" },
    { reel: "Lição 04 · resolver", title: "Siga as pistas.", text: "Seus trabalhos saem ao lado. Pistas vão ao diário. Portas abrem com respostas. Todo puzzle dá dicas.", controls: "Trabalhos · Diário · Dicas" },
    { reel: "Lição 05 · voar", title: "Conquiste o céu.", text: "Recolha o que a história deixou. Ache o traje: F propulsores, Espaço subir, C descer.", controls: "F voar · Espaço subir · C descer" },
    { reel: "Conta · seu nome", title: "Entre uma vez, guarde tudo.", text: "Escolha On-line e entre com Discord ou e-mail. Cada save fica no seu nome.", controls: "On-line → entrar → pronto" },
    { reel: "Amigos · juntos", title: "Corra com amigos.", text: "Na Superfície abra Convidar e mande o link curto. Amigos caem na sua história e correm no placar.", controls: "Convidar → mandar → correr" },
    { reel: "Criar · faça histórias", title: "Título dentro, mundo fora.", text: "No Planejador escreva título e resumo, escolha a IA e aperte Compilar. Confira tudo, Aprove para jogar ou Publique para partilhar.", controls: "Título + resumo → Compilar" },
    { reel: "Crescer · capítulos", title: "Histórias crescem.", text: "Com Continuar você soma pista, nota, capítulo ou missão. O criador aprova e vira história de todos.", controls: "Escrever → enviar → capítulo" },
    { reel: "Guardar · sem perdas", title: "Seu progresso a salvo.", text: "O Menu salva sua partida. Grandes momentos se salvam sozinhos. A voz lê, o micro obedece.", controls: "Menu → Salvar · voz" },
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

