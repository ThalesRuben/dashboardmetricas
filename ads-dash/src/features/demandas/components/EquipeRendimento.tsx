import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { useChartTheme } from '@/shared/lib/chartTheme';
import type { Demanda, TeamMember } from '../api/types';
import { colorForMember, initialsForMember } from './memberColors';
import styles from './EquipeRendimento.module.css';

Chart.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface Props {
  demandas: Demanda[];
  equipe: TeamMember[];
}

const DIAS_JANELA = 14;
const DIA_MS = 86_400_000;

function nomeCurto(full: string): string {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function dataChave(iso: string): string {
  return iso.slice(0, 10);
}

function labelDia(offset: number): string {
  const d = new Date(Date.now() - offset * DIA_MS);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export default function EquipeRendimento({ demandas, equipe }: Props) {
  const t = useChartTheme();

  const janela = useMemo(() => {
    const dias: string[] = [];
    const chaves: string[] = [];
    for (let i = DIAS_JANELA - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * DIA_MS);
      chaves.push(d.toISOString().slice(0, 10));
      dias.push(labelDia(i));
    }
    return { chaves, dias };
  }, []);

  // Adiciona um "bucket" para não-atribuído — evita esconder trabalho de ninguém.
  const membros = useMemo(() => {
    const semDono: TeamMember = { id: '__sem__', full_name: 'Sem responsável' };
    return [...equipe, semDono];
  }, [equipe]);

  const chartData = useMemo(() => {
    const datasets = membros.map(m => {
      const cor = m.id === '__sem__' ? '#556170' : colorForMember(m.id);
      const contagem = janela.chaves.map(chave => {
        return demandas.filter(d => {
          if (!d.concluido_em) return false;
          if ((d.responsavel_id ?? '__sem__') !== m.id) return false;
          return dataChave(d.concluido_em) === chave;
        }).length;
      });
      return {
        label: nomeCurto(m.full_name),
        data: contagem,
        backgroundColor: cor,
        borderRadius: 4,
        borderSkipped: false as const,
      };
    });
    return { labels: janela.dias, datasets };
  }, [demandas, membros, janela]);

  const totalNaJanela = chartData.datasets.reduce(
    (acc, ds) => acc + ds.data.reduce((a, b) => a + b, 0),
    0,
  );

  const linhasTabela = useMemo(() => {
    const agora = Date.now();
    const seteDiasAtras = agora - 7 * DIA_MS;

    return membros.map(m => {
      const minhas = demandas.filter(d => (d.responsavel_id ?? '__sem__') === m.id);
      const wip = minhas.filter(d => d.status === 'fazendo').length;
      const feitas7d = minhas.filter(d => {
        if (!d.concluido_em) return false;
        return new Date(d.concluido_em).getTime() >= seteDiasAtras;
      }).length;
      const backlog = minhas.filter(d => d.status === 'backlog');
      const idadeMediaBacklog = backlog.length === 0
        ? null
        : Math.round(
            backlog.reduce((acc, d) => acc + (agora - new Date(d.criado_em).getTime()) / DIA_MS, 0)
              / backlog.length,
          );
      const total = minhas.length;
      const feitasTotal = minhas.filter(d => d.status === 'feito').length;
      const taxa = total === 0 ? null : Math.round((feitasTotal / total) * 100);

      return {
        id: m.id,
        nome: m.full_name,
        cor: m.id === '__sem__' ? '#556170' : colorForMember(m.id),
        inicial: initialsForMember(m.full_name),
        total,
        wip,
        feitas7d,
        idadeMediaBacklog,
        taxa,
      };
    })
    .filter(row => row.total > 0)
    .sort((a, b) => b.feitas7d - a.feitas7d || b.total - a.total);
  }, [demandas, membros]);

  return (
    <section className={styles.wrapper}>
      <div className={styles.chartCard}>
        <div className={styles.chartHead}>
          <div>
            <h3 className={styles.chartTitle}>Rendimento da equipe</h3>
            <p className={styles.chartSub}>Tarefas concluídas nos últimos {DIAS_JANELA} dias</p>
          </div>
          <div className={styles.chartTotal}>
            <span className={styles.chartTotalValue}>{totalNaJanela}</span>
            <span className={styles.chartTotalLbl}>concluídas</span>
          </div>
        </div>
        <div className={styles.chartBox}>
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom',
                  labels: {
                    color: t.tick,
                    font: { size: 11 },
                    boxWidth: 10,
                    boxHeight: 10,
                    padding: 12,
                  },
                },
                tooltip: {
                  backgroundColor: t.tooltipBg,
                  titleColor: t.tooltipFg,
                  bodyColor: t.tooltipFg,
                },
              },
              scales: {
                x: {
                  stacked: true,
                  ticks: { font: { size: 10 }, color: t.tick },
                  grid: { display: false },
                },
                y: {
                  stacked: true,
                  beginAtZero: true,
                  ticks: {
                    font: { size: 10 },
                    color: t.tick,
                    stepSize: 1,
                    precision: 0,
                  },
                  grid: { color: t.grid },
                },
              },
            }}
          />
        </div>
      </div>

      <div className={styles.tableCard}>
        <h3 className={styles.tableTitle}>Placar da equipe</h3>
        {linhasTabela.length === 0 ? (
          <p className={styles.empty}>Nenhuma tarefa atribuída ainda.</p>
        ) : (
          <div className={styles.tabela} role="table">
            <div className={styles.tabelaHead} role="row">
              <span>Pessoa</span>
              <span title="Em execução agora">Fazendo</span>
              <span title="Concluídas nos últimos 7 dias">7d</span>
              <span title="Idade média das tarefas em backlog">Idade backlog</span>
              <span title="% de tarefas concluídas do total atribuído">%</span>
            </div>
            {linhasTabela.map(row => (
              <div key={row.id} className={styles.tabelaRow} role="row">
                <span className={styles.pessoa}>
                  <span className={styles.avatar} style={{ background: row.cor }}>{row.inicial}</span>
                  <span className={styles.pessoaNome}>{nomeCurto(row.nome)}</span>
                </span>
                <span className={styles.numero}>{row.wip}</span>
                <span className={`${styles.numero} ${row.feitas7d > 0 ? styles.numeroBom : ''}`}>{row.feitas7d}</span>
                <span className={styles.numero}>
                  {row.idadeMediaBacklog == null ? '—' : `${row.idadeMediaBacklog}d`}
                </span>
                <span className={styles.numero}>
                  {row.taxa == null ? '—' : `${row.taxa}%`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
