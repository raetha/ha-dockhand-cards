/**
 * Card-runtime translations — the small subset of i18n keys actually
 * rendered by the cards themselves (not the editors). Kept separate so the
 * card bundle doesn't carry the much-larger editor translation table.
 *
 * Keys here: no_schedules_found (schedules card empty state) plus all nine
 * settings_link_* keys used by icon.ts's settings-link tooltip/label.
 *
 * See i18n-editor.ts for the remaining 83 editor-only keys.
 */

export type CardTranslationKey = keyof typeof en;

const en = {
  no_schedules_found: 'No schedules found.',
  settings_link_edit_environment: 'Edit environment in Dockhand',
  settings_link_unavailable: 'Can’t open Dockhand — the configured URL doesn’t look valid. Check the URL in the ha-dockhand integration’s settings.',
  settings_link_view_container: 'View container in Dockhand',
  settings_link_view_containers: 'View containers in Dockhand',
  settings_link_view_schedules: 'View schedules in Dockhand',
  settings_link_view_stack: 'View stack in Dockhand',
  settings_link_view_stacks: 'View stacks in Dockhand',
  settings_link_view_vulnerabilities: 'View vulnerabilities in Dockhand'
} as const;

const de: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Keine Zeitpläne gefunden.',
  settings_link_edit_environment: 'Umgebung in Dockhand bearbeiten',
  settings_link_unavailable: 'Dockhand kann nicht geöffnet werden — die konfigurierte URL scheint ungültig zu sein. Überprüfen Sie die URL in den Einstellungen der ha-dockhand-Integration.',
  settings_link_view_container: 'Container in Dockhand anzeigen',
  settings_link_view_containers: 'Container in Dockhand anzeigen',
  settings_link_view_schedules: 'Zeitpläne in Dockhand anzeigen',
  settings_link_view_stack: 'Stack in Dockhand anzeigen',
  settings_link_view_stacks: 'Stacks in Dockhand anzeigen',
  settings_link_view_vulnerabilities: 'Sicherheitslücken in Dockhand anzeigen'
};

const es: Record<CardTranslationKey, string> = {
  no_schedules_found: 'No se encontraron horarios.',
  settings_link_edit_environment: 'Editar entorno en Dockhand',
  settings_link_unavailable: 'No se puede abrir Dockhand: la URL configurada no parece válida. Compruebe la URL en la configuración de la integración ha-dockhand.',
  settings_link_view_container: 'Ver contenedor en Dockhand',
  settings_link_view_containers: 'Ver contenedores en Dockhand',
  settings_link_view_schedules: 'Ver horarios en Dockhand',
  settings_link_view_stack: 'Ver stack en Dockhand',
  settings_link_view_stacks: 'Ver stacks en Dockhand',
  settings_link_view_vulnerabilities: 'Ver vulnerabilidades en Dockhand'
};

const fr: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Aucun planning trouvé.',
  settings_link_edit_environment: 'Modifier l’environnement dans Dockhand',
  settings_link_unavailable: 'Impossible d’ouvrir Dockhand — l’URL configurée ne semble pas valide. Vérifiez l’URL dans les paramètres de l’intégration ha-dockhand.',
  settings_link_view_container: 'Voir le conteneur dans Dockhand',
  settings_link_view_containers: 'Voir les conteneurs dans Dockhand',
  settings_link_view_schedules: 'Voir les plannings dans Dockhand',
  settings_link_view_stack: 'Voir la pile dans Dockhand',
  settings_link_view_stacks: 'Voir les piles dans Dockhand',
  settings_link_view_vulnerabilities: 'Voir les vulnérabilités dans Dockhand'
};

const it: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Nessuna pianificazione trovata.',
  settings_link_edit_environment: 'Modifica ambiente in Dockhand',
  settings_link_unavailable: 'Impossibile aprire Dockhand: l’URL configurato non sembra valido. Controlla l’URL nelle impostazioni dell’integrazione ha-dockhand.',
  settings_link_view_container: 'Visualizza container in Dockhand',
  settings_link_view_containers: 'Visualizza container in Dockhand',
  settings_link_view_schedules: 'Visualizza pianificazioni in Dockhand',
  settings_link_view_stack: 'Visualizza stack in Dockhand',
  settings_link_view_stacks: 'Visualizza stack in Dockhand',
  settings_link_view_vulnerabilities: 'Visualizza vulnerabilità in Dockhand'
};

const nb: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Ingen tidsplaner funnet.',
  settings_link_edit_environment: 'Rediger miljø i Dockhand',
  settings_link_unavailable: 'Kan ikke åpne Dockhand — den konfigurerte URL-en ser ikke gyldig ut. Sjekk URL-en i innstillingene for ha-dockhand-integrasjonen.',
  settings_link_view_container: 'Vis container i Dockhand',
  settings_link_view_containers: 'Vis containere i Dockhand',
  settings_link_view_schedules: 'Vis tidsplaner i Dockhand',
  settings_link_view_stack: 'Vis stack i Dockhand',
  settings_link_view_stacks: 'Vis stacker i Dockhand',
  settings_link_view_vulnerabilities: 'Vis sårbarheter i Dockhand'
};

const nl: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Geen schema\'s gevonden.',
  settings_link_edit_environment: 'Omgeving bewerken in Dockhand',
  settings_link_unavailable: 'Kan Dockhand niet openen — de geconfigureerde URL lijkt ongeldig. Controleer de URL in de instellingen van de ha-dockhand-integratie.',
  settings_link_view_container: 'Container bekijken in Dockhand',
  settings_link_view_containers: 'Containers bekijken in Dockhand',
  settings_link_view_schedules: 'Schema\'s bekijken in Dockhand',
  settings_link_view_stack: 'Stack bekijken in Dockhand',
  settings_link_view_stacks: 'Stacks bekijken in Dockhand',
  settings_link_view_vulnerabilities: 'Kwetsbaarheden bekijken in Dockhand'
};

const pl: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Nie znaleziono harmonogramów.',
  settings_link_edit_environment: 'Edytuj środowisko w Dockhand',
  settings_link_unavailable: 'Nie można otworzyć Dockhand — skonfigurowany adres URL wydaje się nieprawidłowy. Sprawdź adres URL w ustawieniach integracji ha-dockhand.',
  settings_link_view_container: 'Wyświetl kontener w Dockhand',
  settings_link_view_containers: 'Wyświetl kontenery w Dockhand',
  settings_link_view_schedules: 'Wyświetl harmonogramy w Dockhand',
  settings_link_view_stack: 'Wyświetl stos w Dockhand',
  settings_link_view_stacks: 'Wyświetl stosy w Dockhand',
  settings_link_view_vulnerabilities: 'Wyświetl podatności w Dockhand'
};

const pt: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Nenhum agendamento encontrado.',
  settings_link_edit_environment: 'Editar ambiente no Dockhand',
  settings_link_unavailable: 'Não é possível abrir o Dockhand — o URL configurado não parece válido. Verifique o URL nas configurações da integração ha-dockhand.',
  settings_link_view_container: 'Ver contêiner no Dockhand',
  settings_link_view_containers: 'Ver contêineres no Dockhand',
  settings_link_view_schedules: 'Ver agendamentos no Dockhand',
  settings_link_view_stack: 'Ver stack no Dockhand',
  settings_link_view_stacks: 'Ver stacks no Dockhand',
  settings_link_view_vulnerabilities: 'Ver vulnerabilidades no Dockhand'
};

const sv: Record<CardTranslationKey, string> = {
  no_schedules_found: 'Inga scheman hittades.',
  settings_link_edit_environment: 'Redigera miljö i Dockhand',
  settings_link_unavailable: 'Det går inte att öppna Dockhand — den konfigurerade URL:en verkar inte giltig. Kontrollera URL:en i inställningarna för ha-dockhand-integrationen.',
  settings_link_view_container: 'Visa container i Dockhand',
  settings_link_view_containers: 'Visa containrar i Dockhand',
  settings_link_view_schedules: 'Visa scheman i Dockhand',
  settings_link_view_stack: 'Visa stack i Dockhand',
  settings_link_view_stacks: 'Visa stackar i Dockhand',
  settings_link_view_vulnerabilities: 'Visa sårbarheter i Dockhand'
};

const zhHans: Record<CardTranslationKey, string> = {
  no_schedules_found: '未找到计划任务。',
  settings_link_edit_environment: '在 Dockhand 中编辑环境',
  settings_link_unavailable: '无法打开 Dockhand — 配置的 URL 看起来无效。请检查 ha-dockhand 集成设置中的 URL。',
  settings_link_view_container: '在 Dockhand 中查看容器',
  settings_link_view_containers: '在 Dockhand 中查看容器',
  settings_link_view_schedules: '在 Dockhand 中查看计划任务',
  settings_link_view_stack: '在 Dockhand 中查看堆栈',
  settings_link_view_stacks: '在 Dockhand 中查看堆栈',
  settings_link_view_vulnerabilities: '在 Dockhand 中查看漏洞'
};

const LOCALES: Record<string, Record<CardTranslationKey, string>> = {
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

/** Looks up a card-runtime translated string for the current HA language,
 * falling back to English for an unsupported language or missing key. */
export function t(hass: { language?: string; locale?: { language?: string } } | undefined, key: CardTranslationKey): string {
  const lang = hass?.locale?.language ?? hass?.language ?? 'en';
  return LOCALES[lang]?.[key] ?? en[key];
}
