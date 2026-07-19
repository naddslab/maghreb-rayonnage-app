import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Lock, Eye, EyeOff, ArrowRight, TrendingUp, Users2 } from 'lucide-react'

export default function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('rachid.balali@maghreb-rayonnage.ma')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [remember, setRemember] = useState(true)

  function handleSubmit(e) {
    e.preventDefault()
    navigate('/dashboard')
  }

  return (
    <div className="flex min-h-screen bg-ink-50">
      {/* Left branding panel */}
      <div className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-accent-glossy p-10 text-white lg:flex">
        <div className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-white/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-28 -left-14 h-72 w-72 rounded-full bg-black/15 blur-2xl" />
        <div className="pointer-events-none absolute right-16 top-16 h-24 w-24 rounded-full bg-white/25 blur-lg" />

        <div className="relative z-10 flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/25 text-[13px] font-extrabold backdrop-blur-sm">
            MR
          </div>
          <span className="text-[14px] font-bold">Maghreb Rayonnage</span>
        </div>

        <div className="relative z-10 max-w-md">
          <h2 className="text-[28px] font-extrabold leading-[1.1] tracking-tight">
            Pilotez vos coffres,<br /> vos clients et votre croissance.
          </h2>
          <p className="mt-3 text-[13.5px] leading-relaxed text-white/85">
            Une vue claire sur vos ventes, vos réunions et le chiffre d’affaires de chaque entité du groupe,
            en un seul tableau de bord.
          </p>

          <div className="mt-8 flex flex-col gap-2.5">
            <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <TrendingUp size={16} />
              </div>
              <div>
                <p className="text-[12.5px] font-bold">Chiffre d’affaires</p>
                <p className="text-[11.5px] text-white/75">1,23M DH sur 12 mois · Meilleur mois : Septembre</p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 p-3.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
                <Users2 size={16} />
              </div>
              <div>
                <p className="text-[12.5px] font-bold">24 clients signés</p>
                <p className="text-[11.5px] text-white/75">+12% ce trimestre sur Maghreb Rayonnage</p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-[11px] text-white/70">© 2026 Maghreb Rayonnage. Tous droits réservés.</p>
      </div>

      {/* Right form panel */}
      <div className="flex w-full flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-[380px]">
          <div className="mb-7 flex flex-col items-center text-center lg:items-start lg:text-left">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent-glossy text-[15px] font-extrabold text-white shadow-glossy lg:hidden">
              MR
            </div>
            <h1 className="text-[22px] font-extrabold leading-tight tracking-tight text-ink-900">Se connecter</h1>
            <p className="mt-1 text-[13px] text-ink-500">
              Accédez à votre espace Maghreb Rayonnage Dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div>
              <label className="label-field">Adresse e-mail</label>
              <div className="relative">
                <Mail size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@entreprise.ma"
                  className="input-field pl-10"
                />
              </div>
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="label-field mb-0">Mot de passe</label>
                <button type="button" className="text-[11.5px] font-bold text-accent-600 hover:text-accent-700">
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="relative">
                <Lock size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="input-field pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                  aria-label="Afficher le mot de passe"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 py-0.5 text-[12.5px] text-ink-500">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-ink-300 text-accent-500 focus:ring-accent-300"
              />
              Se souvenir de moi
            </label>

            <button type="submit" className="btn-primary mt-1 w-full py-3">
              Se connecter
              <ArrowRight size={15} />
            </button>
          </form>

          <p className="mt-7 text-center text-[12.5px] text-ink-400 lg:text-left">
            Besoin d’un compte ? <span className="font-bold text-accent-600">Contactez votre administrateur</span>
          </p>
        </div>
      </div>
    </div>
  )
}
