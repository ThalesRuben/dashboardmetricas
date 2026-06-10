import { useState, useMemo } from 'react'
import { CONTENT_TAGS } from '@/features/competitors/hooks/useCompetitors'
import { generateScript } from '@/lib/aiInsights'
import { useToast } from '@/app/providers/ToastContext'
import styles from './ScriptGenerator.module.css'

export default function ScriptGenerator({ competitors }) {
  const toast = useToast()
  const [tema, setTema] = useState('')
  const [tag, setTag]   = useState('antes-depois')
  const [script, setScript] = useState(null)

  // todos os conteúdos validados (concorrentes + referências)
  const allContent = useMemo(() => {
    const rows = []
    competitors.forEach(c => (c.content || []).forEach(ct => rows.push(ct)))
    return rows
  }, [competitors])

  function handleGenerate() {
    if (!tema.trim()) { toast.error('Descreva o tema do conteúdo.'); return }
    setScript(generateScript(allContent, tema, tag))
  }

  function handleCopy() {
    if (!script) return
    const txt = [
      `ROTEIRO — ${tema}`,
      `Formato: ${script.formato} · Duração: ${script.duracao}`,
      `Áudio: ${script.audioLabel} · Edição: ${script.ritmoLabel}`,
      '',
      ...script.blocos.map(b => `${b.titulo.toUpperCase()}\n${b.texto}\n`),
    ].join('\n')
    navigator.clipboard?.writeText(txt)
    toast.success('Roteiro copiado!')
  }

  const semDados = allContent.length === 0

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>🎬 Gerador de roteiro</h2>
          <p className={styles.sub}>
            Monta um roteiro seguindo o padrão vencedor extraído dos conteúdos validados — o "DNA" do que funciona no seu nicho
          </p>
        </div>
      </div>

      {semDados ? (
        <div className={styles.empty}>
          Registre conteúdos validados de concorrentes/referências primeiro — o roteiro é gerado a partir
          do padrão que mais engaja entre eles.
        </div>
      ) : (
        <>
          <div className={styles.form}>
            <div className={styles.formField}>
              <label className={styles.label}>Tema do conteúdo</label>
              <input
                className={styles.input}
                value={tema}
                onChange={e => setTema(e.target.value)}
                placeholder="Ex: escova progressiva, mechas iluminadas, corte repicado..."
                onKeyDown={e => e.key === 'Enter' && handleGenerate()}
              />
            </div>
            <div className={styles.formField}>
              <label className={styles.label}>Categoria</label>
              <select className={styles.input} value={tag} onChange={e => setTag(e.target.value)}>
                {CONTENT_TAGS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </div>
            <button className={styles.genBtn} onClick={handleGenerate}>Gerar roteiro</button>
          </div>

          {script && (
            <div className={styles.result}>
              <div className={styles.resultHead}>
                <div className={styles.resultMeta}>
                  <span className={styles.metaChip}>📹 {script.formato}</span>
                  <span className={styles.metaChip}>⏱ {script.duracao}</span>
                  <span className={styles.metaChip}>🎵 {script.audioLabel}</span>
                  <span className={styles.metaChip}>✂️ {script.ritmoLabel}</span>
                </div>
                <button className={styles.copyBtn} onClick={handleCopy}>Copiar roteiro</button>
              </div>

              <div className={styles.blocos}>
                {script.blocos.map((b, i) => (
                  <div key={i} className={styles.bloco}>
                    <div className={styles.blocoNum}>{i + 1}</div>
                    <div className={styles.blocoBody}>
                      <div className={styles.blocoTitle}>{b.titulo}</div>
                      <div className={styles.blocoText}>{b.texto}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.footer}>
                Roteiro gerado a partir de {script.baseadoEm} conteúdo(s) validado(s).
                Adapte ao tom da marca antes de produzir.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
