import { useState } from 'react'
import { useAuth } from '@/app/providers/AuthContext'
import { useToast } from '@/app/providers/ToastContext'
import { MetasSettings } from '@/features/metas'
import PageHeader from '@/components/ui/PageHeader'
import styles from './SettingsPage.module.css'

const INITIAL_USERS = [
  { id:1, email:'admin@salao.com',  name:'Administrador', role:'admin',  lastLogin:'Hoje, 10:32' },
  { id:2, email:'gestor@salao.com', name:'Gestor de mídia', role:'editor', lastLogin:'Hoje, 09:15' },
  { id:3, email:'view@salao.com',   name:'Visualizador',   role:'viewer', lastLogin:'Ontem, 18:44' },
]

const ROLE_LABEL = { admin:'Administrador', editor:'Editor', viewer:'Visualizador' }
const ROLE_TAG   = { admin: styles.tagAdmin, editor: styles.tagEditor, viewer: styles.tagViewer }

export default function SettingsPage() {
  const { user, profile } = useAuth()
  const toast = useToast()
  const [users, setUsers] = useState(INITIAL_USERS)
  const [newEmail, setNewEmail] = useState('')
  const [newName, setNewName]   = useState('')
  const [newRole, setNewRole]   = useState('viewer')
  const [twoFa, setTwoFa]       = useState(false)
  const [logAccess, setLogAccess] = useState(true)

  function addUser() {
    if (!newEmail || !newName) {
      toast.error('Informe nome e e-mail.')
      return
    }
    setUsers(u => [...u, {
      id: Date.now(),
      email: newEmail,
      name: newName,
      role: newRole,
      lastLogin: 'Nunca'
    }])
    setNewEmail(''); setNewName('')
    toast.info('Usuário adicionado localmente. Convite real será enviado quando a integração com Supabase Auth estiver conectada.', { title: 'Em breve' })
  }

  function removeUser(id) {
    setUsers(u => u.filter(x => x.id !== id))
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
        <div className={styles.usersTable}>
          <div className={styles.userThead}>
            <span>Nome</span><span>E-mail</span><span>Perfil</span><span>Último acesso</span><span></span>
          </div>
          {users.map(u => (
            <div key={u.id} className={styles.userRow}>
              <span className={styles.userName}>{u.name}</span>
              <span className={styles.userEmail}>{u.email}</span>
              <span className={`${styles.roleTag} ${ROLE_TAG[u.role]}`}>{ROLE_LABEL[u.role]}</span>
              <span className={styles.userLogin}>{u.lastLogin}</span>
              <button className={styles.removeBtn} onClick={() => removeUser(u.id)} title="Remover">✕</button>
            </div>
          ))}
        </div>

        <div className={styles.addRow}>
          <input className={styles.addInput} value={newName}  onChange={e => setNewName(e.target.value)}  placeholder="Nome completo" />
          <input className={styles.addInput} value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="email@exemplo.com" type="email" />
          <select className={styles.addSelect} value={newRole} onChange={e => setNewRole(e.target.value)}>
            <option value="viewer">Visualizador</option>
            <option value="editor">Editor</option>
            <option value="admin">Admin</option>
          </select>
          <button className={styles.addBtn} onClick={addUser}>+ Convidar</button>
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
