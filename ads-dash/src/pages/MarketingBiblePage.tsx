import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BIBLE } from '@/lib/marketingBible'
import PageHeader from '@/components/ui/PageHeader'
import Tabs from '@/components/ui/Tabs'
import styles from './MarketingBiblePage.module.css'

export default function MarketingBiblePage() {
  const [tab, setTab] = useState(() => {
    const h = typeof window !== 'undefined' ? window.location.hash.replace('#', '') : ''
    return BIBLE.some(s => s.id === h) ? h : BIBLE[0].id
  })
  const section = BIBLE.find(s => s.id === tab) || BIBLE[0]
  const dateStr = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div className={styles.page}>
      <PageHeader
        section="bible"
        title="Bíblia do Marketing"
        subtitle="O padrão The Blonde Concept — regras de conteúdo por canal, cronograma e percepção de marca"
        actions={
          <button className="btn btn--primary" onClick={() => window.print()}>
            ⤓ Exportar PDF
          </button>
        }
      />

      <div className={styles.screenView}>
        <Tabs
          items={BIBLE.map(s => ({ id: s.id, label: s.label }))}
          activeId={tab}
          onChange={setTab}
          accentColor="var(--accent-amber)"
        />

        {section.tag && <p className={styles.sectionTag}>{section.tag}</p>}

        <div className={styles.blocks}>
          {section.blocks.map((b, i) => <Block key={i} b={b} />)}
        </div>
      </div>

      {/* Versão completa — só aparece ao imprimir / exportar PDF */}
      <div className={styles.printable} aria-hidden="true">
        <header className={styles.printCover}>
          <p className={styles.printKicker}>BÍBLIA DO MARKETING</p>
          <h1 className={styles.printBrand}>The Blonde Concept</h1>
          <p className={styles.printSubtitle}>O padrão da marca — regras, cronograma e percepção</p>
          <p className={styles.printDate}>Gerada em {dateStr}</p>
        </header>

        <nav className={styles.printToc}>
          <h2 className={styles.printTocTitle}>Sumário</h2>
          <ol>
            {BIBLE.map((s, i) => (
              <li key={s.id}>
                <span className={styles.printTocNum}>{String(i + 1).padStart(2, '0')}.</span>
                <span>{s.label}</span>
                {s.tag && <span className={styles.printTocTag}>— {s.tag}</span>}
              </li>
            ))}
          </ol>
        </nav>

        {BIBLE.map((s, i) => (
          <section key={s.id} className={styles.printSection}>
            <header className={styles.printSecHead}>
              <span className={styles.printSecNum}>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <h2 className={styles.printSecTitle}>{s.label}</h2>
                {s.tag && <p className={styles.printSecTag}>{s.tag}</p>}
              </div>
            </header>
            <div className={styles.blocks}>
              {s.blocks.map((b, j) => <Block key={j} b={b} />)}
            </div>
          </section>
        ))}

        <footer className={styles.printFoot}>
          The Blonde Concept · Bíblia do Marketing · {dateStr}
        </footer>
      </div>
    </div>
  )
}

function Block({ b }) {
  switch (b.t) {
    case 'lead':
      return <p className={styles.lead}>{b.text}</p>

    case 'callout':
      return (
        <div className={styles.callout}>
          <span className={styles.calloutMark}>★</span>
          <p>{b.text}</p>
        </div>
      )

    case 'list':
      return (
        <div className={styles.card}>
          {b.title && <h3 className={styles.cardTitle}>{b.title}</h3>}
          <ul className={styles.list}>
            {b.items.map((it, i) => <li key={i}>{it}</li>)}
          </ul>
        </div>
      )

    case 'tags':
      return (
        <div className={styles.card}>
          {b.title && <h3 className={styles.cardTitle}>{b.title}</h3>}
          <div className={styles.tags}>
            {b.items.map((t, i) => <span key={i} className={styles.tag}>{t}</span>)}
          </div>
        </div>
      )

    case 'refs':
      return (
        <div className={styles.card}>
          {b.title && <h3 className={styles.cardTitle}>{b.title}</h3>}
          <div className={styles.refs}>
            {b.items.map((r, i) => (
              <div key={i} className={styles.ref}>
                <span className={styles.refName}>{r.nome}</span>
                {r.nota && <span className={styles.refNote}>{r.nota}</span>}
              </div>
            ))}
          </div>
        </div>
      )

    case 'formula':
      return (
        <div className={styles.formula}>
          {b.items.map((f, i) => (
            <div key={i} className={styles.formulaRow}>
              <div className={styles.formulaPct}>
                <span className={styles.formulaNum}>{f.pct}%</span>
                <span className={styles.formulaLabel}>{f.label}</span>
              </div>
              <div className={styles.formulaBarWrap}>
                <div className={styles.formulaBar} style={{ width: `${f.pct * 3.1}%` }} />
                <p className={styles.formulaDesc}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      )

    case 'pillars':
      return (
        <div className={styles.pillars}>
          {b.items.map((p, i) => (
            <div key={i} className={styles.pillar}>
              <h3 className={styles.pillarTitle}>{p.titulo}</h3>
              <p className={styles.pillarText}>{p.texto}</p>
            </div>
          ))}
        </div>
      )

    case 'links':
      return (
        <div className={styles.card}>
          {b.title && <h3 className={styles.cardTitle}>{b.title}</h3>}
          <div className={styles.links}>
            {b.items.map((l, i) => (
              <Link key={i} to={l.to} className={styles.linkCard}>
                <span className={styles.linkLabel}>{l.label} →</span>
                <span className={styles.linkDesc}>{l.desc}</span>
              </Link>
            ))}
          </div>
        </div>
      )

    case 'music':
      return (
        <div className={styles.card}>
          {b.title && <h3 className={styles.cardTitle}>{b.title}</h3>}
          <div className={styles.musicGroups}>
            {b.groups.map((g, i) => (
              <div key={i} className={styles.musicGroup}>
                <span className={styles.musicName}>{g.nome}</span>
                <ul className={styles.musicList}>
                  {g.faixas.map((f, j) => <li key={j}>♪ {f}</li>)}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )

    case 'days':
      return (
        <div className={styles.daysGrid}>
          {b.items.map((d, i) => (
            <div key={i} className={styles.day}>
              <div className={styles.dayHead}>
                <span className={styles.dayLabel}>{d.dia}</span>
                <span className={styles.dayName}>{d.nome}</span>
              </div>
              <p className={styles.dayTransmite}>{d.transmite}</p>
              <Meta k="Narrativa" v={d.narrativa} />
              <Meta k="Sensação" v={d.sensacao} />
              <Meta k="Ritmo" v={d.ritmo} />
              <Meta k="Estética" v={d.estetica} />
              <div className={styles.dayAppear}>
                <span className={styles.dayAppearLabel}>O QUE APARECE</span>
                <ul className={styles.dayList}>
                  {d.aparece.map((a, j) => <li key={j}>{a}</li>)}
                </ul>
              </div>
            </div>
          ))}
        </div>
      )

    case 'dont':
      return (
        <div className={styles.dontGrid}>
          {b.items.map((d, i) => (
            <div key={i} className={styles.dont}>
              <h3 className={styles.dontTitle}><span className={styles.dontX}>✕</span> {d.titulo}</h3>
              <ul className={styles.dontList}>
                {d.evitar.map((e, j) => <li key={j}>{e}</li>)}
              </ul>
              <p className={styles.dontRule}>↳ {d.regra}</p>
            </div>
          ))}
        </div>
      )

    default:
      return null
  }
}

function Meta({ k, v }) {
  return (
    <div className={styles.meta}>
      <span className={styles.metaK}>{k}</span>
      <span className={styles.metaV}>{v}</span>
    </div>
  )
}
