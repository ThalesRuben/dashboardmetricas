"""kg-to-obsidian — exporta o grafo LightRAG como vault Obsidian organizado.

Estrutura:
    docs/knowledge-graph/
        INDEX.md                    Hub: contagens + navegacao
        entidades/<tipo>/<slug>.md  Uma pasta por entity_type (PT-BR)
        mocs/comunidade-NN-*.md     Maps of Content por comunidade Louvain
        .obsidian/graph.json        Graph View pre-configurado

Cada arquivo de entidade tem secoes:
    ## Tipo · ## Descricao · ## Conexoes · ## Aparece em · ## Comunidade
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
from collections import defaultdict
from pathlib import Path

import networkx as nx
from rich.console import Console

from . import config

console = Console()

SEP = "<SEP>"

# Mapeamento entity_type -> nome de pasta (pt-BR). Tipos nao mapeados vao para 'diversos'.
ENTITY_TYPE_FOLDERS = {
    "concept": "conceitos",
    "method": "metodos",
    "data": "dados",
    "content": "conteudo",
    "artifact": "artefatos",
    "person": "pessoas",
    "organization": "organizacoes",
    "event": "eventos",
    "component": "componentes",
    "metric": "metricas",
    "location": "lugares",
    "font": "diversos",
    "other": "diversos",
    "UNKNOWN": "diversos",
    "unknown": "diversos",
    "?": "diversos",
    "": "diversos",
}

ENTITY_TYPE_LABELS = {
    "concept": "Conceito",
    "method": "Metodo",
    "data": "Dado",
    "content": "Conteudo",
    "artifact": "Artefato",
    "person": "Pessoa",
    "organization": "Organizacao",
    "event": "Evento",
    "component": "Componente",
    "metric": "Metrica",
    "location": "Lugar",
    "font": "Fonte",
    "other": "Diverso",
    "UNKNOWN": "Nao classificado",
    "unknown": "Nao classificado",
    "?": "Nao classificado",
    "": "Nao classificado",
}


def slugify(text: str) -> str:
    text = (text or "").strip().lower()
    text = re.sub(r"[/\\]", "-", text)
    text = re.sub(r"[^a-z0-9\s_-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-_")
    return text[:180] if text else "unknown"


def short_id(s: str, n: int = 6) -> str:
    return hashlib.sha1(s.encode()).hexdigest()[:n]


def split_sep(val) -> list[str]:
    if not val:
        return []
    return [p.strip() for p in str(val).split(SEP) if p.strip()]


def folder_for(etype: str) -> str:
    return ENTITY_TYPE_FOLDERS.get(etype, "diversos")


def label_for(etype: str) -> str:
    return ENTITY_TYPE_LABELS.get(etype, etype or "Nao classificado")


def load_graph():
    gf = config.WORKING_DIR / "graph_chunk_entity_relation.graphml"
    if not gf.exists():
        raise SystemExit(
            f"Graph file not found: {gf}\nRode antes: `rag index --full`"
        )
    return nx.read_graphml(str(gf))


def detect_communities(g: nx.Graph):
    try:
        from networkx.algorithms.community import louvain_communities

        comms = louvain_communities(nx.Graph(g), seed=42)
    except Exception as e:
        console.print(f"[yellow]Louvain falhou ({e}); comunidade unica.[/yellow]")
        comms = [set(g.nodes())]
    # Ordena comunidades por tamanho decrescente para IDs estaveis
    comms = sorted([set(c) for c in comms], key=lambda c: len(c), reverse=True)
    node2c = {}
    for i, c in enumerate(comms):
        for n in c:
            node2c[n] = i
    return comms, node2c


def build_slug_map(g):
    used = {}
    entity_files = {}
    for n in g.nodes():
        base = slugify(str(n))
        if not base:
            base = "entity-" + short_id(str(n))
        key = base
        if key in used and used[key] != n:
            key = f"{base}-{short_id(str(n))}"
        used[key] = n
        entity_files[n] = key
    return entity_files


def render_description(raw: str) -> str:
    """Recebe descricao com <SEP> e retorna markdown legivel."""
    parts = split_sep(raw)
    if not parts:
        return "_Sem descricao registrada._"
    parts = [p for p in (p.strip() for p in parts) if p]
    if len(parts) == 1:
        return parts[0]
    return "\n".join(f"- {p}" for p in parts)


def render_connections(g, node, entity_files, max_neighbors=300):
    """Agrupa vizinhos por keyword da aresta."""
    neighbors = sorted(g.neighbors(node))[:max_neighbors]
    if not neighbors:
        return ""
    by_keyword: dict[str, list[tuple[str, str]]] = defaultdict(list)
    for nb in neighbors:
        edge = g.get_edge_data(node, nb) or {}
        kw_raw = edge.get("keywords") or edge.get("description") or "relaciona"
        kw = split_sep(kw_raw)[0] if split_sep(kw_raw) else "relaciona"
        # normaliza keyword
        kw_norm = re.sub(r"\s+", " ", kw.strip()).lower()
        if not kw_norm:
            kw_norm = "relaciona"
        slug = entity_files.get(nb, slugify(str(nb)))
        by_keyword[kw_norm].append((slug, str(nb)))
    lines = []
    for kw, items in sorted(by_keyword.items(), key=lambda x: (-len(x[1]), x[0])):
        if len(by_keyword) == 1:
            for slug, _ in items:
                lines.append(f"- [[{slug}]]")
        else:
            lines.append(f"### {kw} ({len(items)})")
            for slug, _ in items:
                lines.append(f"- [[{slug}]]")
            lines.append("")
    return "\n".join(lines).rstrip()


def community_filename(idx: int, top_entity_slug: str) -> str:
    return f"comunidade-{idx:03d}-{top_entity_slug}"


def write_entity_file(
    vault: Path,
    n,
    data: dict,
    g: nx.Graph,
    entity_files: dict,
    node2c: dict,
    comm_top_slug: dict,
):
    name = str(n)
    slug = entity_files[n]
    etype = data.get("entity_type", "") or ""
    desc_md = render_description(data.get("description", ""))
    paths = split_sep(data.get("file_path", ""))
    comm_id = node2c.get(n, -1)
    folder = folder_for(etype)

    target_dir = vault / "entidades" / folder
    target_dir.mkdir(parents=True, exist_ok=True)

    # Frontmatter (Obsidian usa pra filtros / property view)
    safe_name = name.replace('"', "'")
    front = [
        "---",
        f'entity: "{safe_name}"',
        f'entity_type: "{etype or "unknown"}"',
        f'tipo_pt: "{label_for(etype)}"',
        f"community: {comm_id}",
        f"degree: {g.degree(n)}",
        "---",
        "",
    ]
    body = [f"# {name}", ""]

    body.extend(["## Tipo", "", f"**{label_for(etype)}**  ({etype or 'sem categoria'})", ""])

    body.extend(["## Descricao", "", desc_md, ""])

    conn_md = render_connections(g, n, entity_files)
    if conn_md:
        body.extend([f"## Conexoes ({g.degree(n)})", "", conn_md, ""])

    if paths:
        body.append("## Aparece em")
        body.append("")
        for fp in paths[:50]:
            body.append(f"- `{fp}`")
        if len(paths) > 50:
            body.append(f"- _... mais {len(paths) - 50}_")
        body.append("")

    if comm_id in comm_top_slug:
        moc_slug = community_filename(comm_id, comm_top_slug[comm_id])
        body.extend(["## Comunidade", "", f"Faz parte de [[{moc_slug}|Comunidade {comm_id}]].", ""])

    (target_dir / f"{slug}.md").write_text(
        "\n".join(front + body), encoding="utf-8"
    )


MIN_COMMUNITY_SIZE = 3  # comunidades menores nao ganham MOC proprio


def write_moc(vault: Path, idx: int, members: list, g, entity_files: dict):
    if not members or len(members) < MIN_COMMUNITY_SIZE:
        return None
    members_sorted = sorted(members, key=lambda n: g.degree(n), reverse=True)
    top = members_sorted[0]
    top_slug = entity_files[top]
    fname = community_filename(idx, top_slug)

    by_type: dict[str, list] = defaultdict(list)
    for n in members_sorted:
        et = g.nodes[n].get("entity_type", "") or "unknown"
        by_type[et].append(n)

    lines = [
        "---",
        f'tipo: "MOC"',
        f"community: {idx}",
        f"size: {len(members)}",
        "---",
        "",
        f"# Comunidade {idx} - {top}",
        "",
        f"Agrupamento detectado via Louvain (seed=42). "
        f"Reune **{len(members)} entidades** conectadas com o tema central **{top}**.",
        "",
        "## Entidade central",
        "",
        f"- [[{top_slug}]] (degree={g.degree(top)})",
        "",
        "## Membros por tipo",
        "",
    ]
    for et, ns in sorted(by_type.items(), key=lambda x: (-len(x[1]), x[0])):
        lines.append(f"### {label_for(et)} ({len(ns)})")
        lines.append("")
        for n in ns:
            slug = entity_files[n]
            lines.append(f"- [[{slug}]]")
        lines.append("")
    (vault / "mocs" / f"{fname}.md").write_text("\n".join(lines), encoding="utf-8")
    return fname


def write_small_communities_moc(vault: Path, small_comms: list, g, entity_files: dict):
    """Junta todas as comunidades < MIN_COMMUNITY_SIZE em um unico arquivo apendice."""
    if not small_comms:
        return None
    total = sum(len(c) for _, c in small_comms)
    lines = [
        "---",
        'tipo: "MOC-apendice"',
        f"size: {total}",
        "---",
        "",
        "# Comunidades minusculas (apendice)",
        "",
        f"Apendice com **{len(small_comms)} comunidades** que tem menos de "
        f"{MIN_COMMUNITY_SIZE} membros (somando **{total} entidades**). "
        "Geralmente sao entidades isoladas ou duplas que o LLM extraiu "
        "mas nao conseguiu conectar ao resto do grafo. "
        "Util como checklist de ruido / merge candidates.",
        "",
        "## Por tamanho",
        "",
    ]
    # Agrupa por tamanho
    by_size: dict[int, list] = defaultdict(list)
    for idx, members in small_comms:
        by_size[len(members)].append((idx, members))
    for size in sorted(by_size.keys(), reverse=True):
        groups = by_size[size]
        lines.append(f"### {size} membro(s) - {len(groups)} comunidade(s)")
        lines.append("")
        for idx, members in groups:
            slugs = ", ".join(f"[[{entity_files[n]}]]" for n in members)
            lines.append(f"- _C{idx}_: {slugs}")
        lines.append("")
    (vault / "mocs" / "_comunidades-minusculas.md").write_text(
        "\n".join(lines), encoding="utf-8"
    )
    return "_comunidades-minusculas"


def write_index(vault: Path, g, entity_files, comms, type_counts, moc_files, small_moc_name):
    n_nodes = g.number_of_nodes()
    n_edges = g.number_of_edges()
    avg_deg = (2 * n_edges) / n_nodes if n_nodes else 0

    # Buckets de degree
    deg_buckets = {"ge10": 0, "ge5": 0, "ge3": 0, "ge1": 0, "iso": 0}
    for _, d in g.degree:
        if d >= 10:
            deg_buckets["ge10"] += 1
        if d >= 5:
            deg_buckets["ge5"] += 1
        if d >= 3:
            deg_buckets["ge3"] += 1
        if d >= 1:
            deg_buckets["ge1"] += 1
        if d == 0:
            deg_buckets["iso"] += 1

    big_comms = [(i, c) for i, c in enumerate(comms) if len(c) >= MIN_COMMUNITY_SIZE]
    small_comms_count = len(comms) - len(big_comms)
    small_total = sum(len(c) for c in comms if len(c) < MIN_COMMUNITY_SIZE)

    lines = [
        "# Indice do Knowledge Graph",
        "",
        "Mapa do grafo de conhecimento extraido de **ads-dash** (The Blonde Concept). "
        "Cada entidade vira um arquivo; conexoes viram wikilinks; comunidades viram MOCs.",
        "",
        "> **Comece por aqui:** as secoes **Entidades centrais** e **Comunidades principais** "
        "logo abaixo concentram o sinal. As demais sao referencia / apendice.",
        "",
        "## Resumo",
        "",
        f"- **Entidades:** {n_nodes:,}",
        f"- **Relacoes:** {n_edges:,}",
        f"- **Conexoes medias por entidade:** {avg_deg:.2f}  "
        f"_(grafos de codigo costumam ficar entre 1 e 2; densos ficam > 3)_",
        f"- **Comunidades grandes (>= {MIN_COMMUNITY_SIZE}):** {len(big_comms)}",
        f"- **Comunidades minusculas (< {MIN_COMMUNITY_SIZE}):** {small_comms_count} "
        f"(somando {small_total} entidades)"
        + (f" -> [[{small_moc_name}|ver apendice]]" if small_moc_name else ""),
        "",
        "## Qualidade do grafo (distribuicao de degree)",
        "",
        f"- **Bem conectadas (degree >= 10):** {deg_buckets['ge10']}  "
        f"_({100*deg_buckets['ge10']/n_nodes:.1f}%)_",
        f"- **Conectadas (degree >= 5):** {deg_buckets['ge5']}  "
        f"_({100*deg_buckets['ge5']/n_nodes:.1f}%)_",
        f"- **Razoaveis (degree >= 3):** {deg_buckets['ge3']}  "
        f"_({100*deg_buckets['ge3']/n_nodes:.1f}%)_",
        f"- **Pelo menos uma conexao (degree >= 1):** {deg_buckets['ge1']}  "
        f"_({100*deg_buckets['ge1']/n_nodes:.1f}%)_",
        f"- **Isoladas (degree = 0):** {deg_buckets['iso']}  "
        f"_({100*deg_buckets['iso']/n_nodes:.1f}%)_  "
        "_(geralmente ruido extraido pelo LLM)_",
        "",
        "## Entidades centrais (Top 30 por degree)",
        "",
    ]
    deg = sorted(g.degree, key=lambda x: x[1], reverse=True)[:30]
    for n, d in deg:
        slug = entity_files.get(n)
        if slug:
            etype = g.nodes[n].get("entity_type", "") or "?"
            lines.append(f"- [[{slug}]] - {d} conexoes _({label_for(etype)})_")

    lines.extend(["", "## Comunidades principais (size >= 5)", ""])
    big_comms_sorted = sorted(big_comms, key=lambda x: -len(x[1]))
    shown = 0
    for idx, members in big_comms_sorted:
        if len(members) < 5:
            continue
        if idx not in moc_files:
            continue
        members_sorted = sorted(members, key=lambda n: g.degree(n), reverse=True)
        top = members_sorted[0]
        top_slug = entity_files[top]
        lines.append(
            f"- [[{moc_files[idx]}|Comunidade {idx}]] - **{len(members)}** entidades, "
            f"centrada em [[{top_slug}]]"
        )
        shown += 1
        if shown >= 25:
            break
    remaining = sum(1 for _, m in big_comms_sorted if 5 <= len(m)) - shown
    if remaining > 0:
        lines.append(f"- _... mais {remaining} comunidades de tamanho 5+ em_ `mocs/`")
    medium = sum(1 for _, m in big_comms_sorted if MIN_COMMUNITY_SIZE <= len(m) < 5)
    if medium > 0:
        lines.append(
            f"- _comunidades de 3-4 membros: {medium} (ver_ `mocs/` _)_"
        )

    lines.extend(["", "## Navegar por tipo de entidade", ""])
    # Coloca "Diverso" / "Nao classificado" no final
    def type_sort_key(item):
        etype, count = item
        is_noise = etype in ("other", "UNKNOWN", "unknown", "", "?")
        return (is_noise, -count)

    for etype, count in sorted(type_counts.items(), key=type_sort_key):
        if count == 0:
            continue
        folder = folder_for(etype)
        label = label_for(etype)
        note = ""
        if etype in ("other", "UNKNOWN", "unknown", "", "?"):
            note = "  _(maioria e ruido / entidades sem categoria; navegue com cuidado)_"
        lines.append(f"- **{label}** ({count}) -> `entidades/{folder}/`{note}")

    lines.append("")
    (vault / "INDEX.md").write_text("\n".join(lines), encoding="utf-8")


def write_obsidian_config(vault: Path):
    obs = vault / ".obsidian"
    obs.mkdir(exist_ok=True)
    graph_cfg = {
        "collapse-filter": True,
        "search": "path:entidades/",
        "showTags": False,
        "showAttachments": False,
        "hideUnresolved": False,
        "showOrphans": True,
        "collapse-color-groups": False,
        "colorGroups": [
            {"query": 'path:"entidades/conceitos/"', "color": {"a": 1, "rgb": 16737996}},
            {"query": 'path:"entidades/metodos/"', "color": {"a": 1, "rgb": 4570875}},
            {"query": 'path:"entidades/dados/"', "color": {"a": 1, "rgb": 4109794}},
            {"query": 'path:"entidades/conteudo/"', "color": {"a": 1, "rgb": 15848209}},
            {"query": 'path:"entidades/artefatos/"', "color": {"a": 1, "rgb": 13070788}},
            {"query": 'path:"entidades/pessoas/"', "color": {"a": 1, "rgb": 4886754}},
            {"query": 'path:"entidades/organizacoes/"', "color": {"a": 1, "rgb": 11796479}},
            {"query": 'path:"entidades/componentes/"', "color": {"a": 1, "rgb": 7846335}},
            {"query": 'path:"mocs/"', "color": {"a": 1, "rgb": 16776960}},
        ],
        "collapse-display": False,
        "showArrow": False,
        "textFadeMultiplier": 0,
        "nodeSizeMultiplier": 1,
        "lineSizeMultiplier": 1,
        "collapse-forces": False,
        "centerStrength": 0.5,
        "repelStrength": 10,
        "linkStrength": 1,
        "linkDistance": 250,
        "scale": 1,
        "close": True,
    }
    (obs / "graph.json").write_text(json.dumps(graph_cfg, indent=2), encoding="utf-8")
    (obs / "app.json").write_text(
        json.dumps(
            {"newLinkFormat": "shortest", "useMarkdownLinks": False, "alwaysUpdateLinks": True},
            indent=2,
        ),
        encoding="utf-8",
    )


def export(clean: bool = False):
    vault = config.VAULT_DIR

    if clean and vault.exists():
        backup = None
        obs = vault / ".obsidian"
        if obs.exists():
            backup = vault.parent / ".obsidian_backup_kg"
            if backup.exists():
                shutil.rmtree(backup)
            shutil.copytree(obs, backup)
        shutil.rmtree(vault)
        vault.mkdir(parents=True)
        if backup:
            shutil.copytree(backup, vault / ".obsidian")
            shutil.rmtree(backup)
    else:
        vault.mkdir(parents=True, exist_ok=True)

    (vault / "entidades").mkdir(exist_ok=True)
    (vault / "mocs").mkdir(exist_ok=True)

    g = load_graph()
    comms, node2c = detect_communities(g)
    entity_files = build_slug_map(g)

    # Para cada comunidade, decide a entidade central (maior degree) -> usada no MOC e nos links
    comm_top_slug: dict[int, str] = {}
    for idx, members in enumerate(comms):
        if not members:
            continue
        top = max(members, key=lambda n: g.degree(n))
        comm_top_slug[idx] = entity_files[top]

    # Escreve MOCs (so para comunidades >= MIN_COMMUNITY_SIZE)
    moc_files: dict[int, str] = {}
    small_comms = []
    for idx, members in enumerate(comms):
        if not members:
            continue
        if len(members) < MIN_COMMUNITY_SIZE:
            small_comms.append((idx, list(members)))
            continue
        fname = write_moc(vault, idx, list(members), g, entity_files)
        if fname:
            moc_files[idx] = fname

    # MOC apendice com todas as comunidades minusculas juntas
    small_moc_name = write_small_communities_moc(vault, small_comms, g, entity_files)

    # Escreve entidades
    type_counts: dict[str, int] = defaultdict(int)
    for n, data in g.nodes(data=True):
        write_entity_file(vault, n, data, g, entity_files, node2c, comm_top_slug)
        type_counts[data.get("entity_type", "") or ""] += 1

    # INDEX
    write_index(vault, g, entity_files, comms, type_counts, moc_files, small_moc_name)
    write_obsidian_config(vault)

    console.print(f"[green]Vault escrito em:[/green] {vault}")
    console.print(
        f"  Entidades: {g.number_of_nodes()}  "
        f"Relacoes: {g.number_of_edges()}  "
        f"Comunidades: {len(comms)} ({len(moc_files)} MOCs + {len(small_comms)} minusculas)"
    )
    console.print("  Por tipo:")
    for etype, count in sorted(type_counts.items(), key=lambda x: -x[1]):
        if count:
            console.print(f"    - {label_for(etype):20s} {count:5d}  -> entidades/{folder_for(etype)}/")


def main():
    p = argparse.ArgumentParser(prog="kg-to-obsidian")
    p.add_argument(
        "--clean",
        action="store_true",
        help="Deleta vault antes de regenerar (preserva .obsidian/).",
    )
    args = p.parse_args()
    export(clean=args.clean)


if __name__ == "__main__":
    main()
