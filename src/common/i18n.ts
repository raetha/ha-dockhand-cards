/**
 * Home Assistant's own translation system (strings.json/translations/*.json)
 * only covers backend-declared strings for integrations — it has no channel
 * for a Lovelace card's own UI text. This is the standard workaround used by
 * localized custom cards generally: a small bundled per-locale dictionary,
 * looked up by hass.locale.language at render time.
 *
 * Scope (v1, 2026-07-13): editor labels and hints only — the highest-value,
 * most-visible strings for a non-English speaker actually configuring a
 * card. Live-card-rendered labels (e.g. "Images", "CPU", "Stacks") are not
 * yet translated — see docs/BACKLOG.md for why that's a larger, separate
 * pass and what's still English-only.
 *
 * Locale list matches ha-dockhand's exactly (de, es, fr, it, nb, nl, pl, pt,
 * sv, zh-Hans), machine-translated the same way: translate immediately when
 * a new key is added, never leave a locale partially stale.
 */

export type TranslationKey = keyof typeof en;

const en = {
  environment: 'Environment',
  stack: 'Stack',
  container: 'Container',
  title_override: 'Title override (optional)',
  show_settings_link: 'Show link to open in Dockhand',
  display_mode: 'Display mode',
  mode_compact: 'Compact',
  mode_standard: 'Standard',
  mode_detailed: 'Detailed',
  mode_full: 'Full',
  mode_custom: 'Custom',
  no_environments_found: 'No Dockhand environment devices found. Make sure the ha-dockhand integration is set up and has at least one environment configured.',
  no_stacks_found: 'No stacks found for this environment yet.',
  no_containers_found: 'No containers found for this environment yet.',
  columns: 'Columns',
  columns_auto: 'Auto (fits available width, mobile-friendly)',
  defaults_heading: 'Defaults (applied to every environment unless overridden below)',
  environments_heading: 'Environments',
  show_this_environment: 'Show this environment',
  mode_override: 'Mode override (blank = use default)',
  use_default: 'Use default'
} as const;

const de: Record<TranslationKey, string> = {
  environment: 'Umgebung',
  stack: 'Stack',
  container: 'Container',
  title_override: 'Titel überschreiben (optional)',
  show_settings_link: 'Link zum Öffnen in Dockhand anzeigen',
  display_mode: 'Anzeigemodus',
  mode_compact: 'Kompakt',
  mode_standard: 'Standard',
  mode_detailed: 'Detailliert',
  mode_full: 'Vollständig',
  mode_custom: 'Benutzerdefiniert',
  no_environments_found: 'Keine Dockhand-Umgebungsgeräte gefunden. Stellen Sie sicher, dass die ha-dockhand-Integration eingerichtet ist und mindestens eine Umgebung konfiguriert wurde.',
  no_stacks_found: 'Für diese Umgebung wurden noch keine Stacks gefunden.',
  no_containers_found: 'Für diese Umgebung wurden noch keine Container gefunden.',
  columns: 'Spalten',
  columns_auto: 'Automatisch (passt sich der verfügbaren Breite an, mobilfreundlich)',
  defaults_heading: 'Standardwerte (gelten für jede Umgebung, sofern unten nicht überschrieben)',
  environments_heading: 'Umgebungen',
  show_this_environment: 'Diese Umgebung anzeigen',
  mode_override: 'Modus überschreiben (leer = Standard verwenden)',
  use_default: 'Standard verwenden'
};

const es: Record<TranslationKey, string> = {
  environment: 'Entorno',
  stack: 'Stack',
  container: 'Contenedor',
  title_override: 'Título personalizado (opcional)',
  show_settings_link: 'Mostrar enlace para abrir en Dockhand',
  display_mode: 'Modo de visualización',
  mode_compact: 'Compacto',
  mode_standard: 'Estándar',
  mode_detailed: 'Detallado',
  mode_full: 'Completo',
  mode_custom: 'Personalizado',
  no_environments_found: 'No se encontraron dispositivos de entorno de Dockhand. Asegúrese de que la integración ha-dockhand esté configurada y tenga al menos un entorno configurado.',
  no_stacks_found: 'Aún no se encontraron stacks para este entorno.',
  no_containers_found: 'Aún no se encontraron contenedores para este entorno.',
  columns: 'Columnas',
  columns_auto: 'Automático (se ajusta al ancho disponible, apto para móviles)',
  defaults_heading: 'Valores predeterminados (se aplican a cada entorno salvo que se anulen abajo)',
  environments_heading: 'Entornos',
  show_this_environment: 'Mostrar este entorno',
  mode_override: 'Anular modo (vacío = usar predeterminado)',
  use_default: 'Usar predeterminado'
};

const fr: Record<TranslationKey, string> = {
  environment: 'Environnement',
  stack: 'Stack',
  container: 'Conteneur',
  title_override: 'Titre personnalisé (facultatif)',
  show_settings_link: 'Afficher le lien pour ouvrir dans Dockhand',
  display_mode: "Mode d'affichage",
  mode_compact: 'Compact',
  mode_standard: 'Standard',
  mode_detailed: 'Détaillé',
  mode_full: 'Complet',
  mode_custom: 'Personnalisé',
  no_environments_found: "Aucun appareil d'environnement Dockhand trouvé. Assurez-vous que l'intégration ha-dockhand est configurée et qu'au moins un environnement est défini.",
  no_stacks_found: 'Aucun stack trouvé pour cet environnement pour le moment.',
  no_containers_found: 'Aucun conteneur trouvé pour cet environnement pour le moment.',
  columns: 'Colonnes',
  columns_auto: "Automatique (s'adapte à la largeur disponible, adapté au mobile)",
  defaults_heading: 'Valeurs par défaut (appliquées à chaque environnement sauf modification ci-dessous)',
  environments_heading: 'Environnements',
  show_this_environment: 'Afficher cet environnement',
  mode_override: 'Remplacer le mode (vide = utiliser la valeur par défaut)',
  use_default: 'Utiliser la valeur par défaut'
};

const it: Record<TranslationKey, string> = {
  environment: 'Ambiente',
  stack: 'Stack',
  container: 'Container',
  title_override: 'Titolo personalizzato (opzionale)',
  show_settings_link: 'Mostra link per aprire in Dockhand',
  display_mode: 'Modalità di visualizzazione',
  mode_compact: 'Compatta',
  mode_standard: 'Standard',
  mode_detailed: 'Dettagliata',
  mode_full: 'Completa',
  mode_custom: 'Personalizzato',
  no_environments_found: "Nessun dispositivo ambiente Dockhand trovato. Assicurati che l'integrazione ha-dockhand sia configurata e che ci sia almeno un ambiente impostato.",
  no_stacks_found: 'Nessuno stack trovato ancora per questo ambiente.',
  no_containers_found: 'Nessun container trovato ancora per questo ambiente.',
  columns: 'Colonne',
  columns_auto: "Automatico (si adatta alla larghezza disponibile, ottimizzato per mobile)",
  defaults_heading: "Valori predefiniti (applicati a ogni ambiente salvo modifiche sotto)",
  environments_heading: 'Ambienti',
  show_this_environment: 'Mostra questo ambiente',
  mode_override: 'Sovrascrivi modalità (vuoto = usa predefinita)',
  use_default: 'Usa predefinita'
};

const nb: Record<TranslationKey, string> = {
  environment: 'Miljø',
  stack: 'Stack',
  container: 'Container',
  title_override: 'Tittel-overstyring (valgfritt)',
  show_settings_link: 'Vis lenke for å åpne i Dockhand',
  display_mode: 'Visningsmodus',
  mode_compact: 'Kompakt',
  mode_standard: 'Standard',
  mode_detailed: 'Detaljert',
  mode_full: 'Full',
  mode_custom: 'Egendefinert',
  no_environments_found: 'Fant ingen Dockhand-miljøenheter. Kontroller at ha-dockhand-integrasjonen er satt opp og har minst ett miljø konfigurert.',
  no_stacks_found: 'Fant ingen stacker for dette miljøet ennå.',
  no_containers_found: 'Fant ingen containere for dette miljøet ennå.',
  columns: 'Kolonner',
  columns_auto: 'Automatisk (tilpasser seg tilgjengelig bredde, mobilvennlig)',
  defaults_heading: 'Standardverdier (brukes for alle miljøer med mindre de overstyres under)',
  environments_heading: 'Miljøer',
  show_this_environment: 'Vis dette miljøet',
  mode_override: 'Overstyr modus (tomt = bruk standard)',
  use_default: 'Bruk standard'
};

const nl: Record<TranslationKey, string> = {
  environment: 'Omgeving',
  stack: 'Stack',
  container: 'Container',
  title_override: 'Titel overschrijven (optioneel)',
  show_settings_link: 'Link tonen om te openen in Dockhand',
  display_mode: 'Weergavemodus',
  mode_compact: 'Compact',
  mode_standard: 'Standaard',
  mode_detailed: 'Gedetailleerd',
  mode_full: 'Volledig',
  mode_custom: 'Aangepast',
  no_environments_found: 'Geen Dockhand-omgevingsapparaten gevonden. Zorg dat de ha-dockhand-integratie is ingesteld en minstens één omgeving is geconfigureerd.',
  no_stacks_found: 'Nog geen stacks gevonden voor deze omgeving.',
  no_containers_found: 'Nog geen containers gevonden voor deze omgeving.',
  columns: 'Kolommen',
  columns_auto: 'Automatisch (past zich aan beschikbare breedte aan, mobielvriendelijk)',
  defaults_heading: 'Standaardwaarden (toegepast op elke omgeving tenzij hieronder overschreven)',
  environments_heading: 'Omgevingen',
  show_this_environment: 'Deze omgeving tonen',
  mode_override: 'Modus overschrijven (leeg = standaard gebruiken)',
  use_default: 'Standaard gebruiken'
};

const pl: Record<TranslationKey, string> = {
  environment: 'Środowisko',
  stack: 'Stos',
  container: 'Kontener',
  title_override: 'Nadpisanie tytułu (opcjonalnie)',
  show_settings_link: 'Pokaż link do otwarcia w Dockhand',
  display_mode: 'Tryb wyświetlania',
  mode_compact: 'Kompaktowy',
  mode_standard: 'Standardowy',
  mode_detailed: 'Szczegółowy',
  mode_full: 'Pełny',
  mode_custom: 'Niestandardowy',
  no_environments_found: 'Nie znaleziono urządzeń środowiska Dockhand. Upewnij się, że integracja ha-dockhand jest skonfigurowana i ma co najmniej jedno środowisko.',
  no_stacks_found: 'Nie znaleziono jeszcze żadnych stosów dla tego środowiska.',
  no_containers_found: 'Nie znaleziono jeszcze żadnych kontenerów dla tego środowiska.',
  columns: 'Kolumny',
  columns_auto: 'Automatyczny (dopasowuje się do dostępnej szerokości, przyjazny dla urządzeń mobilnych)',
  defaults_heading: 'Wartości domyślne (stosowane do każdego środowiska, chyba że nadpisane poniżej)',
  environments_heading: 'Środowiska',
  show_this_environment: 'Pokaż to środowisko',
  mode_override: 'Nadpisz tryb (puste = użyj domyślnego)',
  use_default: 'Użyj domyślnego'
};

const pt: Record<TranslationKey, string> = {
  environment: 'Ambiente',
  stack: 'Stack',
  container: 'Contêiner',
  title_override: 'Substituir título (opcional)',
  show_settings_link: 'Mostrar link para abrir no Dockhand',
  display_mode: 'Modo de exibição',
  mode_compact: 'Compacto',
  mode_standard: 'Padrão',
  mode_detailed: 'Detalhado',
  mode_full: 'Completo',
  mode_custom: 'Personalizado',
  no_environments_found: 'Nenhum dispositivo de ambiente Dockhand encontrado. Verifique se a integração ha-dockhand está configurada e tem pelo menos um ambiente definido.',
  no_stacks_found: 'Nenhuma stack encontrada para este ambiente ainda.',
  no_containers_found: 'Nenhum contêiner encontrado para este ambiente ainda.',
  columns: 'Colunas',
  columns_auto: 'Automático (ajusta-se à largura disponível, compatível com dispositivos móveis)',
  defaults_heading: 'Padrões (aplicados a todos os ambientes, salvo substituição abaixo)',
  environments_heading: 'Ambientes',
  show_this_environment: 'Mostrar este ambiente',
  mode_override: 'Substituir modo (vazio = usar padrão)',
  use_default: 'Usar padrão'
};

const sv: Record<TranslationKey, string> = {
  environment: 'Miljö',
  stack: 'Stack',
  container: 'Container',
  title_override: 'Titeländring (valfritt)',
  show_settings_link: 'Visa länk för att öppna i Dockhand',
  display_mode: 'Visningsläge',
  mode_compact: 'Kompakt',
  mode_standard: 'Standard',
  mode_detailed: 'Detaljerad',
  mode_full: 'Fullständig',
  mode_custom: 'Anpassad',
  no_environments_found: 'Inga Dockhand-miljöenheter hittades. Kontrollera att ha-dockhand-integrationen är konfigurerad och har minst en miljö inställd.',
  no_stacks_found: 'Inga stackar hittades för denna miljö ännu.',
  no_containers_found: 'Inga containrar hittades för denna miljö ännu.',
  columns: 'Kolumner',
  columns_auto: 'Automatisk (anpassar sig efter tillgänglig bredd, mobilvänlig)',
  defaults_heading: 'Standardvärden (gäller alla miljöer om inte annat anges nedan)',
  environments_heading: 'Miljöer',
  show_this_environment: 'Visa denna miljö',
  mode_override: 'Åsidosätt läge (tomt = använd standard)',
  use_default: 'Använd standard'
};

const zhHans: Record<TranslationKey, string> = {
  environment: '环境',
  stack: '堆栈',
  container: '容器',
  title_override: '标题覆盖（可选）',
  show_settings_link: '显示在 Dockhand 中打开的链接',
  display_mode: '显示模式',
  mode_compact: '紧凑',
  mode_standard: '标准',
  mode_detailed: '详细',
  mode_full: '完整',
  mode_custom: '自定义',
  no_environments_found: '未找到 Dockhand 环境设备。请确保已设置 ha-dockhand 集成并至少配置了一个环境。',
  no_stacks_found: '此环境尚未找到任何堆栈。',
  no_containers_found: '此环境尚未找到任何容器。',
  columns: '列数',
  columns_auto: '自动（适应可用宽度，适合移动端）',
  defaults_heading: '默认值（应用于每个环境，除非在下方覆盖）',
  environments_heading: '环境',
  show_this_environment: '显示此环境',
  mode_override: '模式覆盖（留空 = 使用默认值）',
  use_default: '使用默认值'
};

const LOCALES: Record<string, Record<TranslationKey, string>> = {
  en,
  de,
  es,
  fr,
  it,
  nb,
  nl,
  pl,
  pt,
  sv,
  'zh-Hans': zhHans
};

/** Looks up a translated string for the current HA language, falling back
 * to English for an unsupported language or a key not yet translated for
 * one — never throws, never shows a raw key to the user. */
export function t(hass: { language?: string; locale?: { language?: string } } | undefined, key: TranslationKey): string {
  const lang = hass?.locale?.language ?? hass?.language ?? 'en';
  return LOCALES[lang]?.[key] ?? en[key];
}
