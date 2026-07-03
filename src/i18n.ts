import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const resources = {
  en: {
    translation: {
      "app_title": "ZeroTier Manager",
      "login_sudo_password": "Sudo Password",
      "login_insert_password": "Enter root password",
      "login_remember": "Remember Password",
      "login_windows_mode": "Windows Mode",
      "login_windows_info": "No password needed. Make sure you started this application as Administrator, otherwise you won't be able to read or modify the network state.",
      "login_error": "Wrong password or ZeroTier not installed. ({{error}})",
      "login_button": "Login",
      "join_network_title": "Join a Network",
      "import_btn": "Import",
      "export_btn": "Export",
      "join_placeholder": "Enter Network ID (e.g. 8056c2e21c...)",
      "join_btn": "Join",
      "my_networks": "My Networks",
      "filter_ALL": "ALL",
      "filter_ACTIVE": "ACTIVE",
      "filter_INACTIVE": "INACTIVE",
      "filter_SUSPENDED": "SUSPENDED",
      "search_placeholder": "Search by name or ID...",
      "no_networks_filtered": "No networks match the current filters.",
      "no_networks_found": "No networks found. Join a network by entering the ID above.",
      "status_active": "Active",
      "status_disconnected": "Disconnected",
      "req_ip": "Requesting IP...",
      "dev_label": "Dev: {{dev}}",
      "leave_btn": "Leave",
      "delete_history": "Delete from history",
      "error_join": "Join error: {{error}}",
      "error_leave": "Leave error: {{error}}",
      "error_refresh": "Refresh error: {{error}}",
      "error_export": "Export error: {{error}}",
      "error_import": "Error importing JSON file."
    }
  },
  it: {
    translation: {
      "app_title": "ZeroTier Manager",
      "login_sudo_password": "Password Sudo",
      "login_insert_password": "Inserisci password root",
      "login_remember": "Ricorda Password",
      "login_windows_mode": "Modalità Windows",
      "login_windows_info": "Non è necessaria la password. Assicurati di aver avviato questa applicazione come Amministratore, altrimenti non potrai leggere o modificare lo stato delle reti.",
      "login_error": "Password errata o ZeroTier non installato. ({{error}})",
      "login_button": "Accedi",
      "join_network_title": "Unisciti a una rete",
      "import_btn": "Importa",
      "export_btn": "Esporta",
      "join_placeholder": "Inserisci ID Rete (es. 8056c2e21c...)",
      "join_btn": "Join",
      "my_networks": "Le mie Reti",
      "filter_ALL": "TUTTE",
      "filter_ACTIVE": "ATTIVE",
      "filter_INACTIVE": "NON_ATTIVE",
      "filter_SUSPENDED": "IN_SOSPESO",
      "search_placeholder": "Cerca per nome o ID...",
      "no_networks_filtered": "Nessuna rete corrisponde ai filtri impostati.",
      "no_networks_found": "Nessuna rete trovata. Unisciti a una rete inserendo l'ID qui sopra.",
      "status_active": "Attiva",
      "status_disconnected": "Disconnessa",
      "req_ip": "Richiesta IP in corso...",
      "dev_label": "Dev: {{dev}}",
      "leave_btn": "Leave",
      "delete_history": "Elimina dalla cronologia",
      "error_join": "Errore durante il join: {{error}}",
      "error_leave": "Errore durante il leave: {{error}}",
      "error_refresh": "Errore refresh: {{error}}",
      "error_export": "Errore durante l'esportazione: {{error}}",
      "error_import": "Errore durante l'importazione del file JSON."
    }
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;
