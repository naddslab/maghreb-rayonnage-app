import { useEffect, useRef, useState } from 'react'
import { Bell, Globe, Lock, Moon, Mail, Phone, Camera, Bot, Check, Save, AlertCircle } from 'lucide-react'
import Layout from '../components/Layout'
import FactsPanel from '../components/FactsPanel'
import { currentUser, defaultSystemPrompt, defaultKnowledgeBase } from '../data/mockData'
import { apiUrl, authHeaders } from '../lib/api'

function Toggle({ checked, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={
        'relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 ' +
        (checked ? 'bg-accent-500' : 'bg-ink-200')
      }
      aria-pressed={checked}
    >
      <span
        className={
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200 ' +
          (checked ? 'translate-x-5' : 'translate-x-0.5')
        }
      />
    </button>
  )
}

function SettingRow({ icon: Icon, title, description, control }) {
  return (
    <div className="flex items-center gap-3.5 py-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-500">
        <Icon size={15} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-bold text-ink-800">{title}</p>
        {description && <p className="mt-0.5 text-[11.5px] text-ink-400">{description}</p>}
      </div>
      {control}
    </div>
  )
}

export default function Settings() {
  const [displayName, setDisplayName] = useState(currentUser.name)
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt)
  const [knowledgeBase, setKnowledgeBase] = useState(defaultKnowledgeBase)
  const [isLoadingAiSettings, setIsLoadingAiSettings] = useState(true)
  const [notifEmail, setNotifEmail] = useState(true)
  const [notifPush, setNotifPush] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [twoFactor, setTwoFactor] = useState(true)
  const [saved, setSaved] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const hasEditedRef = useRef(false)

  useEffect(() => {
    let isMounted = true
    fetch(apiUrl('/api/ai-settings'), { headers: authHeaders() })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!isMounted || !data || hasEditedRef.current) return
        if (typeof data.system_prompt === 'string' && data.system_prompt) setSystemPrompt(data.system_prompt)
        if (typeof data.business_context === 'string') setKnowledgeBase(data.business_context)
      })
      .catch(() => {
        // Backend not reachable yet — keep the local defaults already shown.
      })
      .finally(() => {
        if (isMounted) setIsLoadingAiSettings(false)
      })
    return () => {
      isMounted = false
    }
  }, [])

  async function handleSave(e) {
    e.preventDefault()
    setSaveError('')
    setIsSaving(true)
    try {
      const res = await fetch(apiUrl('/api/ai-settings'), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ system_prompt: systemPrompt, business_context: knowledgeBase }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Erreur lors de l'enregistrement.")
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2600)
    } catch (err) {
      setSaveError(err.message || "Erreur lors de l'enregistrement.")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Layout title="Réglages" subtitle="Gérez votre profil et l'assistant IA">
      <form onSubmit={handleSave} className="flex flex-col gap-3.5">
        <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-3">
          <div className="card flex flex-col items-center p-5 text-center lg:col-span-1">
            <div className="relative">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent-100 text-[20px] font-extrabold text-accent-600">
                {displayName
                  .split(' ')
                  .map((p) => p[0])
                  .slice(0, 2)
                  .join('')
                  .toUpperCase()}
              </div>
              <button
                type="button"
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-ink-900 text-white"
                aria-label="Changer la photo"
              >
                <Camera size={12} />
              </button>
            </div>
            <p className="mt-3 text-[12.5px] text-ink-500">{currentUser.role}</p>

            <div className="mt-4 w-full text-left">
              <label className="label-field">Nom affiché</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="input-field"
              />
            </div>

            <div className="mt-3 flex w-full flex-col gap-2 text-left">
              <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2 text-[12px] text-ink-600">
                <Mail size={13} className="shrink-0 text-ink-400" />
                <span className="truncate">{currentUser.email}</span>
              </div>
              <div className="flex items-center gap-2.5 rounded-lg border border-ink-200 px-3 py-2 text-[12px] text-ink-600">
                <Phone size={13} className="shrink-0 text-ink-400" />
                +212 6 61 22 34 56
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-3.5 lg:col-span-2">
            <div className="card p-4">
              <h3 className="text-[13px] font-bold text-ink-500">Notifications</h3>
              <div className="mt-0.5 divide-y divide-ink-100">
                <SettingRow
                  icon={Mail}
                  title="Notifications par e-mail"
                  description="Résumés hebdomadaires et alertes de coffre"
                  control={<Toggle checked={notifEmail} onChange={setNotifEmail} />}
                />
                <SettingRow
                  icon={Bell}
                  title="Notifications push"
                  description="Réunions à venir et nouveaux clients signés"
                  control={<Toggle checked={notifPush} onChange={setNotifPush} />}
                />
              </div>
            </div>

            <div className="card p-4">
              <h3 className="text-[13px] font-bold text-ink-500">Préférences</h3>
              <div className="mt-0.5 divide-y divide-ink-100">
                <SettingRow
                  icon={Globe}
                  title="Langue"
                  description="Français"
                  control={<span className="text-[12px] font-bold text-accent-600">Modifier</span>}
                />
                <SettingRow
                  icon={Moon}
                  title="Mode sombre"
                  description="Adapter l'interface pour un usage en soirée"
                  control={<Toggle checked={darkMode} onChange={setDarkMode} />}
                />
                <SettingRow
                  icon={Lock}
                  title="Authentification à deux facteurs"
                  description="Sécurisez votre compte avec un code SMS"
                  control={<Toggle checked={twoFactor} onChange={setTwoFactor} />}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center gap-2.5 border-b border-ink-200 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-glossy text-white">
              <Bot size={15} />
            </div>
            <div>
              <h3 className="text-[13.5px] font-bold text-ink-800">Assistant IA</h3>
              <p className="text-[11.5px] text-ink-400">
                {isLoadingAiSettings
                  ? 'Chargement des paramètres enregistrés…'
                  : 'Personnalisez le comportement et les connaissances de votre assistant'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-2">
            <div>
              <label className="label-field">Instructions personnalisées</label>
              <textarea
                value={systemPrompt}
                onChange={(e) => {
                  hasEditedRef.current = true
                  setSystemPrompt(e.target.value)
                }}
                rows={10}
                className="input-field resize-none font-mono text-[12px] leading-relaxed"
                placeholder="Ajoutez des instructions spécifiques à votre façon de travailler…"
              />
              <p className="mt-1.5 text-[11px] text-ink-400">
                Ces notes s&apos;ajoutent au comportement de base de l&apos;assistant (toujours actif en code). Laissez ce champ vide ou identique au défaut pour utiliser uniquement le comportement standard.
              </p>
            </div>
            <div>
              <label className="label-field">Contexte métier</label>
              <textarea
                value={knowledgeBase}
                onChange={(e) => {
                  hasEditedRef.current = true
                  setKnowledgeBase(e.target.value)
                }}
                rows={10}
                className="input-field resize-none font-mono text-[12px] leading-relaxed"
                placeholder="Ajoutez le contexte métier : coffres, tarifs, politiques…"
              />
              <p className="mt-1.5 text-[11px] text-ink-400">
                Notes libres toujours incluses au contexte de l&apos;assistant. Pour les faits appris automatiquement
                (clients, objectifs, tâches, dates), voir la Base de connaissances ci-dessous.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pb-2">
          {saveError && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-rose-600">
              <AlertCircle size={15} />
              {saveError}
            </span>
          )}
          {saved && !saveError && (
            <span className="flex items-center gap-1.5 text-[12.5px] font-bold text-emerald-600">
              <Check size={15} />
              Paramètres sauvegardés avec succès
            </span>
          )}
          <button type="submit" className="btn-primary" disabled={isSaving}>
            <Save size={15} />
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </form>

      <div className="mt-3.5">
        <FactsPanel />
      </div>
    </Layout>
  )
}
