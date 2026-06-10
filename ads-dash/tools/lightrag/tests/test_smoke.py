def test_imports():
    from lightrag_kg import cli, config, index, llm, rag, server, to_obsidian  # noqa: F401


def test_paths_resolve():
    from lightrag_kg import config

    assert config.PROJECT_ROOT.name == "ads-dash"
    assert config.PACKAGE_ROOT.name == "lightrag"
    assert config.PACKAGE_ROOT.parent.name == "tools"


def test_slugify():
    from lightrag_kg.index import slugify

    assert slugify("src/components/ui/CampaignTable.jsx") == "src-components-ui-campaigntablejsx"
    assert slugify("  Hello World!  ") == "hello-world"
    assert slugify("") == "unknown"
