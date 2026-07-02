import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { Moon, Sun, Network, Lock, Loader2, Plus, LogOut, AlertCircle, RefreshCw, Trash2, Search, X, Download, Upload } from "lucide-react";
import "./App.css";

interface ZTNetwork {
  id: string;
  name: string;
  mac: string;
  status: string;
  type: string;
  dev: string;
  ips: string[];
}

interface SavedNetwork {
  id: string;
  name: string;
}

export default function App() {
  const [password, setPassword] = useState("");
  const [rememberPass, setRememberPass] = useState(false);
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [silentLoading, setSilentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [activeNetworks, setActiveNetworks] = useState<ZTNetwork[]>([]);
  const [savedNetworks, setSavedNetworks] = useState<SavedNetwork[]>([]);
  const [newNetId, setNewNetId] = useState("");
  
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  const [filterStatus, setFilterStatus] = useState<"TUTTE" | "ATTIVE" | "NON_ATTIVE" | "IN_SOSPESO">("TUTTE");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isWin, setIsWin] = useState(false);

  useEffect(() => {
    invoke<boolean>("is_windows").then(setIsWin).catch(console.error);

    const savedTheme = localStorage.getItem("theme");
    if (savedTheme === "light") {
      setTheme("light");
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.classList.add("dark");
    }

    const savedPass = localStorage.getItem("sudo_pass");
    if (savedPass) {
      setPassword(savedPass);
      setRememberPass(true);
      checkAuth(savedPass);
    }

    const loadNets = async () => {
      try {
        const savedNets = await invoke<string>("load_networks");
        const parsed = JSON.parse(savedNets);
        if (Array.isArray(parsed)) setSavedNetworks(parsed);
      } catch (e) {
        console.error("Errore lettura reti:", e);
      }
    };
    loadNets();
  }, []);

  // Timer per l'aggiornamento silenzioso
  useEffect(() => {
    if (!isAuthed || !password) return;

    const intervalId = setInterval(async () => {
      setSilentLoading(true);
      try {
        const output = await invoke<string>("run_zerotier", { 
          password: password, 
          args: ["listnetworks"] 
        });
        const parsed = parseNetworks(output);
        setActiveNetworks(parsed);
        syncSavedNetworks(parsed);
      } catch (e) {
        // Ignoriamo gli errori del timer silenzioso per non riempire di notifiche
      } finally {
        setSilentLoading(false);
      }
    }, 10000);

    return () => clearInterval(intervalId);
  }, [isAuthed, password]);

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
    localStorage.setItem("theme", newTheme);
    if (newTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const parseNetworks = (output: string): ZTNetwork[] => {
    const lines = output.split('\n');
    const networks: ZTNetwork[] = [];
    for (const line of lines) {
      if (line.startsWith('200 listnetworks')) {
        const parts = line.trim().split(/\s+/);
        if (parts[2] === '<nwid>') continue; // header
        if (parts.length < 8) continue; // Malformed line
        
        const id = parts[2] || '';
        
        // Estraggo i campi fissi partendo dalla fine
        const ipsString = parts[parts.length - 1];
        const dev = parts[parts.length - 2];
        const type = parts[parts.length - 3];
        const status = parts[parts.length - 4];
        const mac = parts[parts.length - 5];
        
        // Il nome è quello che c'è in mezzo
        const name = parts.slice(3, parts.length - 5).join(' ');
        
        const ips = ipsString && ipsString !== '-' ? ipsString.split(',') : [];

        if (id) {
          networks.push({ id, name: name !== '-' && name ? name : 'Unknown', mac, status, type, dev, ips });
        }
      }
    }
    return networks;
  };

  const syncSavedNetworks = (currentActive: ZTNetwork[]) => {
    setSavedNetworks(prev => {
      const updatedSaved = [...prev];
      let changed = false;

      for (const net of currentActive) {
        const existingIndex = updatedSaved.findIndex(sn => sn.id === net.id);
        if (existingIndex === -1) {
          updatedSaved.push({ id: net.id, name: net.name });
          changed = true;
        } else if (net.name !== 'Unknown' && updatedSaved[existingIndex].name === 'Unknown') {
          updatedSaved[existingIndex].name = net.name;
          changed = true;
        }
      }

      if (changed) {
        invoke("save_networks", { networksJson: JSON.stringify(updatedSaved) }).catch(console.error);
        return updatedSaved;
      }
      return prev;
    });
  };

  const checkAuth = async (pass: string) => {
    setLoading(true);
    setError(null);
    try {
      const output = await invoke<string>("run_zerotier", { 
        password: pass, 
        args: ["listnetworks"] 
      });
      setIsAuthed(true);
      if (rememberPass) {
        localStorage.setItem("sudo_pass", pass);
      } else {
        localStorage.removeItem("sudo_pass");
      }
      
      const parsed = parseNetworks(output);
      setActiveNetworks(parsed);
      syncSavedNetworks(parsed);
    } catch (e: any) {
      setError("Password errata o ZeroTier non installato. (" + e + ")");
      setIsAuthed(false);
      localStorage.removeItem("sudo_pass");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    checkAuth(password);
  };

  const handleJoin = async (id: string) => {
    setLoading(true);
    try {
      await invoke("run_zerotier", { password, args: ["join", id] });
      await refreshNetworks();
    } catch (e: any) {
      setError("Errore durante il join: " + e);
    } finally {
      setLoading(false);
    }
  };

  const handleLeave = async (id: string) => {
    setLoading(true);
    try {
      await invoke("run_zerotier", { password, args: ["leave", id] });
      await refreshNetworks();
    } catch (e: any) {
      setError("Errore durante il leave: " + e);
    } finally {
      setLoading(false);
    }
  };

  const refreshNetworks = async () => {
    setLoading(true);
    try {
      const output = await invoke<string>("run_zerotier", { 
        password, 
        args: ["listnetworks"] 
      });
      const parsed = parseNetworks(output);
      setActiveNetworks(parsed);
      syncSavedNetworks(parsed);
    } catch (e: any) {
      setError("Errore refresh: " + e);
    } finally {
      setLoading(false);
    }
  };

  const deleteSavedNetwork = (id: string) => {
    setSavedNetworks(prev => {
      const updatedSaved = prev.filter(sn => sn.id !== id);
      invoke("save_networks", { networksJson: JSON.stringify(updatedSaved) }).catch(console.error);
      return updatedSaved;
    });
  };

  const logout = () => {
    localStorage.removeItem("sudo_pass");
    setIsAuthed(false);
    setPassword("");
  };

  const handleExport = async () => {
    try {
      const dataStr = JSON.stringify(savedNetworks, null, 2);
      const filePath = await save({
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }],
        defaultPath: 'zerotier_networks.json'
      });

      if (filePath) {
        await invoke("save_file", { path: filePath, contents: dataStr });
      }
    } catch (e: any) {
      setError("Errore durante l'esportazione: " + (e.message || String(e)));
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const imported = JSON.parse(event.target?.result as string);
        if (Array.isArray(imported)) {
          setSavedNetworks(prev => {
            const merged = [...prev];
            let changed = false;
            imported.forEach(imp => {
              if (imp.id && !merged.find(n => n.id === imp.id)) {
                merged.push({ id: imp.id, name: imp.name || 'Unknown' });
                changed = true;
              }
            });
            if (changed) {
              invoke("save_networks", { networksJson: JSON.stringify(merged) }).catch(console.error);
            }
            return merged;
          });
        }
      } catch (err) {
        setError("Errore durante l'importazione del file JSON.");
      }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  if (!isAuthed) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl shadow-xl overflow-hidden border border-slate-200 dark:border-slate-700">
          <div className="p-8">
            <div className="flex justify-between items-center mb-8">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Network className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  ZT NetGUI
                </h1>
              </div>
              <button onClick={toggleTheme} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                {theme === "dark" ? <Sun className="w-5 h-5 text-amber-500" /> : <Moon className="w-5 h-5 text-slate-600" />}
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-6">
              {!isWin ? (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                      Password Sudo
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-slate-400" />
                      </div>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="block w-full pl-10 pr-3 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all text-slate-900 dark:text-white"
                        placeholder="Inserisci password root"
                        required
                      />
                    </div>
                  </div>

                  <div className="flex items-center">
                    <input
                      id="remember"
                      type="checkbox"
                      checked={rememberPass}
                      onChange={(e) => setRememberPass(e.target.checked)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded rounded-md"
                    />
                    <label htmlFor="remember" className="ml-2 block text-sm text-slate-700 dark:text-slate-300">
                      Ricorda Password
                    </label>
                  </div>
                </>
              ) : (
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-sm rounded-xl border border-blue-200 dark:border-blue-800">
                  <p className="font-medium mb-1 flex items-center gap-2"><Lock className="w-4 h-4" /> Modalità Windows</p>
                  <p>Non è necessaria la password. Assicurati di aver avviato questa applicazione come <b>Amministratore</b>, altrimenti non potrai leggere o modificare lo stato delle reti.</p>
                </div>
              )}

              {error && (
                <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || (!isWin && !password)}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98]"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Accedi"}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // Combine active and saved networks, then filter
  const displayNetworks = savedNetworks
    .map(saved => {
      const active = activeNetworks.find(a => a.id === saved.id);
      return {
        id: saved.id,
        name: active?.name !== 'Unknown' && active?.name ? active.name : saved.name,
        isActive: !!active,
        status: active?.status || "INACTIVE",
        ips: active?.ips || [],
        mac: active?.mac || "",
        dev: active?.dev || ""
      };
    })
    .filter(net => {
      // 1. Filtro per stato
      if (filterStatus === "ATTIVE" && (!net.isActive || net.status !== "OK")) return false;
      if (filterStatus === "NON_ATTIVE" && net.isActive) return false;
      if (filterStatus === "IN_SOSPESO" && (!net.isActive || net.status === "OK")) return false; // Per status come ACCESS_DENIED, REQUESTING_CONFIGURATION, ecc.
      
      // 2. Filtro per ricerca testo
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return net.name.toLowerCase().includes(q) || net.id.toLowerCase().includes(q);
      }
      
      return true;
    });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-4 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center relative">
              <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              {silentLoading && (
                <div className="absolute top-0 right-0 -mt-1 -mr-1">
                  <span className="flex h-2.5 w-2.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                  </span>
                </div>
              )}
            </div>
            <h1 className="text-xl font-bold text-slate-800 dark:text-white">
              ZeroTier Manager
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={refreshNetworks} disabled={loading} className="p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors disabled:opacity-50">
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={toggleTheme} className="p-2.5 rounded-lg text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700 transition-colors">
              {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button onClick={logout} className="p-2.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors ml-2">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-xl flex items-start gap-2 border border-red-200 dark:border-red-800">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Add Network */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">Unisciti a una rete</h2>
            <div className="flex gap-2">
              <input type="file" accept=".json" ref={fileInputRef} onChange={handleImport} className="hidden" />
              <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                <Upload className="w-4 h-4" /> Importa
              </button>
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors">
                <Download className="w-4 h-4" /> Esporta
              </button>
            </div>
          </div>
          <div className="flex gap-3">
            <input
              type="text"
              value={newNetId}
              onChange={(e) => setNewNetId(e.target.value)}
              placeholder="Inserisci ID Rete (es. 8056c2e21c...)"
              className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900/50 focus:ring-2 focus:ring-blue-500 outline-none transition-all dark:text-white"
            />
            <button
              onClick={() => {
                if (newNetId) {
                  handleJoin(newNetId);
                  setNewNetId("");
                }
              }}
              disabled={loading || !newNetId}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium transition-all active:scale-[0.98] disabled:opacity-50 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Join
            </button>
          </div>
        </div>

        {/* Network List */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
          
          <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center">
                Le mie Reti
                <span className="ml-3 text-xs font-normal px-2.5 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300">
                  {displayNetworks.length}
                </span>
              </h2>
              
              {/* Segmented Control Filtri */}
              <div className="flex flex-wrap items-center bg-slate-100 dark:bg-slate-900/50 p-1 rounded-lg">
                {(["TUTTE", "ATTIVE", "NON_ATTIVE", "IN_SOSPESO"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setFilterStatus(f)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                      filterStatus === f 
                        ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                    }`}
                  >
                    {f.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Bar */}
            <div className="flex items-center justify-end">
              <div className={`flex items-center transition-all duration-300 ${isSearchExpanded || searchQuery ? 'w-full sm:w-64 opacity-100' : 'w-10 opacity-100'} bg-slate-100 dark:bg-slate-900/50 rounded-xl overflow-hidden border border-transparent focus-within:border-blue-500/50 focus-within:ring-2 focus-within:ring-blue-500/20`}>
                <button 
                  onClick={() => setIsSearchExpanded(true)} 
                  className="p-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <Search className="w-5 h-5 ml-0.5" />
                </button>
                
                <input
                  type="text"
                  placeholder="Cerca per nome o ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchExpanded(true)}
                  onBlur={() => {
                    if (!searchQuery) setIsSearchExpanded(false);
                  }}
                  className={`bg-transparent border-none outline-none text-sm text-slate-700 dark:text-slate-200 py-2 transition-all ${isSearchExpanded || searchQuery ? 'w-full px-2' : 'w-0 px-0'}`}
                />
                
                {searchQuery && (
                  <button 
                    onClick={() => {
                      setSearchQuery("");
                      setIsSearchExpanded(false);
                    }} 
                    className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {displayNetworks.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                {searchQuery || filterStatus !== "TUTTE" 
                  ? "Nessuna rete corrisponde ai filtri impostati." 
                  : "Nessuna rete trovata. Unisciti a una rete inserendo l'ID qui sopra."}
              </div>
            ) : (
              displayNetworks.map(net => (
                <div key={net.id} className="p-6 hover:bg-slate-50/50 dark:hover:bg-slate-800/50 transition-colors group">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    
                    <div className="flex items-start gap-4">
                      <div className={`mt-1 w-3 h-3 rounded-full shrink-0 ${net.isActive && net.status === 'OK' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : net.isActive ? 'bg-amber-500' : 'bg-slate-300 dark:bg-slate-600'}`} />
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white text-lg flex items-center gap-2">
                          {net.name}
                          {net.isActive && net.status === 'OK' && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Attiva
                            </span>
                          )}
                          {net.isActive && net.status !== 'OK' && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                              {net.status}
                            </span>
                          )}
                          {!net.isActive && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                              Disconnessa
                            </span>
                          )}
                        </h3>
                        <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 font-mono">
                          {net.id}
                        </div>
                        
                        {net.isActive && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {net.ips.length > 0 ? (
                              net.ips.map(ip => (
                                <span key={ip} className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border border-blue-100 dark:border-blue-800/50">
                                  {ip}
                                </span>
                              ))
                            ) : (
                              <span className="text-xs text-amber-600 dark:text-amber-400">Richiesta IP in corso...</span>
                            )}
                            <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                              Dev: {net.dev || "N/A"}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pl-7 md:pl-0">
                      {net.isActive ? (
                        <button
                          onClick={() => handleLeave(net.id)}
                          disabled={loading}
                          className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:hover:bg-red-900/40 dark:text-red-400 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
                        >
                          Leave
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleJoin(net.id)}
                            disabled={loading}
                            className="px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/40 dark:text-blue-400 rounded-xl font-medium transition-colors text-sm disabled:opacity-50"
                          >
                            Join
                          </button>
                          <button
                            onClick={() => deleteSavedNetwork(net.id)}
                            disabled={loading}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-colors md:opacity-0 group-hover:opacity-100"
                            title="Elimina dalla cronologia"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>

                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
