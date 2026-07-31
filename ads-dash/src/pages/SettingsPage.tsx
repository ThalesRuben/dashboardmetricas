import { useEffect, useState } from 'react'
import { useAuth } from '@/app/providers/AuthContext'
import { useToast } from '@/app/providers/ToastContext'
import { MetasSettings } from '@/features/metas'
import PageHeader from '@/components/ui/PageHeader'
import { supabase } from '@/shared/lib/supabase'
import { fmtTimeAgo } from '@/shared/lib/format'
import styles from './SettingsPage.module.css'

interface TeamMember {
  id: string
  full_name: string
  email: string
  role: string
  member_since: string
  last_sign_in: string | null
}

const ROLE_LABEL: Record<string, string> = {
  owner: 'Dono', admin: 'Administrador', editor: 'Editor',
  member: 'Membro', viewer: 'Visualizador',
}
const ROLE_TAG: Record<string, string> = {
  owner:  styles.tagAdmin,
  admin:  styles.tagAdmin,
  editor: styles.tagEditor,
  member: styles.tagEditor,
  viewer: styles.tagViewer,
}

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState<TeamMember[]>([])
  const [usersLoading, setUsersLoading] = useState(true)
  const [usersError, setUsersError] = useState<string | null>(null)
  const [twoFa, setTwoFa]       = useState(false)
  const [logAccess, setLogAccess] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function loadTeam() {
      setUsersLoading(true)
      const { data, error } = await supabase.rpc('list_team_members')
      if (cancelled) return
      if (error) {
        setUsersError(error.message)
        setUsers([])
      } else {
        setUsersError(null)
        setUsers((data as TeamMember[]) || [])
      }
      setUsersLoading(false)
    }
    loadTeam()
    return () => { cancelled = true }
  }, [])

  function handleInvite() {
    toast.info(
      'Convites são enviados pelo painel do Supabase → Authentication → Users → Add user.',
      { title: 'Ainda não conectado por aqui' },
    )
  }

  function handleSave() {
    toast.info('Persistência de perfil ainda não conectada ao Supabase.', { title: 'Em breve' })
  }

  const initials = (profile?.full_name || user?.email || 'U')
    .split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div className={styles.page}>
      <PageHeader
        section="settings"
        title="Configurações"
        subtitle="Gerencie usuários, segurança e preferências do sistema"
      />

      <div className={styles.grid}>
        {/* Perfil */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Meu perfil</h2>
          <div className={styles.profileRow}>
            <div className={styles.avatar}>{initials}</div>
            <div>
              <div className={styles.profileName}>{profile?.full_name || user?.email?.split('@')[0] || 'Usuário'}</div>
              <div className={styles.profileEmail}>{user?.email || 'email@exemplo.com'}</div>
              <span className={`${styles.roleTag} ${ROLE_TAG[profile?.role || 'viewer']}`}>
                {ROLE_LABEL[profile?.role || 'viewer']}
              </span>
            </div>
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nome completo</label>
            <input className={styles.input} defaultValue={profile?.full_name || ''} placeholder="Seu nome" />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Nova senha</label>
            <input className={styles.input} type="password" placeholder="••••••••" />
          </div>
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Confirmar nova senha</label>
            <input className={styles.input} type="password" placeholder="••••••••" />
          </div>
          <button
            className={`${styles.saveBtn} ${styles.saveBtnSoon}`}
            onClick={handleSave}
            title="Persistência ainda não conectada — em breve"
          >
            Salvar perfil (em breve)
          </button>
        </div>

        {/* Segurança */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Segurança</h2>
          <div className={styles.secList}>
            <SecRow label="Bloqueio após tentativas" value="3 tentativas" />
            <SecRow label="Tempo de bloqueio" value="30 segundos" />
            <SecRow label="Expiração da sessão" value="8 horas" />
            <div className={styles.secRow}>
              <div>
                <div className={styles.secLabel}>Autenticação em dois fatores (2FA)</div>
                <div className={styles.secDesc}>Exige código extra no login</div>
              </div>
              <Toggle checked={twoFa} onChange={() => setTwoFa(v => !v)} />
            </div>
            <div className={styles.secRow}>
              <div>
                <div className={styles.secLabel}>Log de acessos</div>
                <div className={styles.secDesc}>Registra todos os logins no Supabase</div>
              </div>
              <Toggle checked={logAccess} onChange={() => setLogAccess(v => !v)} />
            </div>
          </div>

          <div className={styles.divider} />

          <h2 className={styles.cardTitle} style={{ marginTop: 0 }}>Supabase</h2>
          <div className={styles.infoBox}>
            As configurações de autenticação real são feitas no painel do Supabase em <strong>Authentication → Providers</strong>. Ative o e-mail, configure o 2FA e defina a política de senhas por lá.
          </div>
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className={styles.linkBtn}
          >
            Abrir painel Supabase ↗
          </a>
        </div>
      </div>

      {/* Metas — âncora pra deep-link de outras telas (/settings#metas) */}
      <div id="metas" style={{ marginTop: 14 }}>
        <MetasSettings />
      </div>

      {/* Usuários */}
      <div className={styles.card} style={{ marginTop: 14 }}>
        <h2 className={styles.cardTitle}>Usuários com acesso</h2>

        {usersLoading ? (
          <div className={styles.loading}>Carregando membros do time...</div>
        ) : usersError ? (
          <div className={styles.infoBox}>
            Não consegui listar membros: <code>{usersError}</code>.<br />
            Se você ainda não rodou a migration <code>0032_list_team_members.sql</code>,
            cole o SQL no <a href="https://supabase.com/dashboard/project/wvygpfeaifhkzxyrfzte/sql/new" target="_blank" rel="noreferrer">SQL Editor</a>.
          </div>
        ) : users.length === 0 ? (
          <div className={styles.infoBox}>
            Nenhum membro no tenant. Adicione pelo Supabase → Authentication → Users.
          </div>
        ) : (
          <div className={styles.usersTable}>
            <div className={styles.userThead}>
              <span>Nome</span><span>E-mail</span><span>Perfil</span><span>Último acesso</span><span></span>
            </div>
            {users.map(u => (
              <div key={u.id} className={styles.userRow}>
                <span className={styles.userName}>
                  {u.full_name || <em style={{ color: 'var(--text-subtle)' }}>sem nome</em>}
                </span>
                <span className={styles.userEmail}>{u.email}</span>
                <span className={`${styles.roleTag} ${ROLE_TAG[u.role] || styles.tagViewer}`}>
                  {ROLE_LABEL[u.role] || u.role}
                </span>
                <span className={styles.userLogin}>
                  {u.last_sign_in ? fmtTimeAgo(u.last_sign_in) : 'nunca'}
                </span>
                <span />
              </div>
            ))}
          </div>
        )}

        <div className={styles.addRow}>
          <button className={styles.addBtn} onClick={handleInvite} style={{ width: '100%' }}>
            + Convidar novo usuário
          </button>
        </div>
      </div>
    </div>
  )
}

function SecRow({ label, value }) {
  return (
    <div className={styles.secRow}>
      <span className={styles.secLabel}>{label}</span>
      <span className={styles.secValue}>{value}</span>
    </div>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <label className={styles.toggle}>
      <input type="checkbox" checked={checked} onChange={onChange} className={styles.toggleInput} />
      <span className={styles.toggleSlider} />
    </label>
  )
}
