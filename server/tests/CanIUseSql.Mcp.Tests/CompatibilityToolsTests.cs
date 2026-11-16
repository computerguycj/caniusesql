using CanIUseSql.Catalog;
using ModelContextProtocol;

namespace CanIUseSql.Mcp.Tests;

// The tools are plain static methods, so these call them directly with a
// small catalog. What the model sees over the wire (tool names, schemas) is
// the SDK's job and isn't tested here.
public class CompatibilityToolsTests
{
    private static readonly string[] AllDialects = ["mysql", "postgresql", "sqlserver", "oracle", "sqlite"];

    // Notes carry the dialect's own key, so a test can tell the entries apart.
    private static string Entry(string slug)
    {
        var dialects = string.Join(", ", AllDialects.Select(d =>
            $$"""  "{{d}}": { "supported": true, "notes": "{{d}}", "native": true, "workaround": null }"""));
        return $$"""
            { "description": "d", "syntax": "s", "category": "c", "slug": "{{slug}}",
              "compatibility": { {{dialects}} }, "details": "x", "overview": "o" }
            """;
    }

    private static CommandCatalog Catalog(params string[] slugs) =>
        CommandCatalog.Parse("{" + string.Join(", ", slugs.Select(s => $"\"{s}\": {Entry(s)}")) + "}");

    private static readonly CommandCatalog Merge = Catalog("merge");

    [Fact]
    public void Check_without_dialects_reports_all_of_them()
    {
        var all = CompatibilityTools.CheckCompatibility(Merge, "merge");
        var empty = CompatibilityTools.CheckCompatibility(Merge, "merge", []);

        Assert.Equal("merge", all.Name);
        Assert.Equal("merge", all.Slug);
        Assert.Equal(AllDialects, all.Compatibility.Keys);
        Assert.Equal(AllDialects, empty.Compatibility.Keys);
    }

    [Fact]
    public void Check_with_dialects_reports_only_those_in_the_order_asked()
    {
        var report = CompatibilityTools.CheckCompatibility(Merge, "merge", ["oracle", "mysql"]);

        Assert.Equal(["oracle", "mysql"], report.Compatibility.Keys);
        Assert.Equal("oracle", report.Compatibility["oracle"].Notes);
        Assert.Equal("mysql", report.Compatibility["mysql"].Notes);
    }

    [Theory]
    [InlineData("postgresql", "postgresql")]
    [InlineData("PostgreSQL", "postgresql")]
    [InlineData("Postgres", "postgresql")]
    [InlineData("SQL Server", "sqlserver")]
    [InlineData("sql-server", "sqlserver")]
    [InlineData("sql_server", "sqlserver")]
    [InlineData("MSSQL", "sqlserver")]
    [InlineData("T-SQL", "sqlserver")]
    [InlineData("MySQL", "mysql")]
    [InlineData("ORACLE", "oracle")]
    [InlineData("SQLite", "sqlite")]
    public void Check_accepts_the_spellings_a_model_is_likely_to_use(string asked, string key)
    {
        var report = CompatibilityTools.CheckCompatibility(Merge, "merge", [asked]);

        // Keyed by data.json's name, whatever was asked for.
        var (dialect, support) = Assert.Single(report.Compatibility);
        Assert.Equal(key, dialect);
        Assert.Equal(key, support.Notes);
    }

    [Fact]
    public void Check_reports_a_dialect_once_when_asked_for_it_twice()
    {
        var report = CompatibilityTools.CheckCompatibility(Merge, "merge", ["postgres", "PostgreSQL"]);

        Assert.Equal(["postgresql"], report.Compatibility.Keys);
    }

    [Fact]
    public void Check_with_an_unknown_dialect_fails_and_lists_the_valid_ones()
    {
        // One bad dialect fails the call, even next to a good one: a partial
        // answer would look complete.
        var error = Assert.Throws<McpException>(
            () => CompatibilityTools.CheckCompatibility(Merge, "merge", ["mysql", "db2"]));

        Assert.Contains("'db2'", error.Message);
        Assert.Contains("mysql, postgresql, sqlserver, oracle, sqlite", error.Message);
    }

    [Fact]
    public void Check_with_an_unknown_slug_fails_and_points_at_search()
    {
        var error = Assert.Throws<McpException>(
            () => CompatibilityTools.CheckCompatibility(Merge, "nope"));

        Assert.Contains("'nope'", error.Message);
        Assert.Contains("search_commands", error.Message);
    }

    [Fact]
    public void Search_returns_matches_with_their_slugs()
    {
        var catalog = Catalog("merge", "upsert");

        var match = Assert.Single(CompatibilityTools.SearchCommands(catalog, "upsert"));

        Assert.Equal("upsert", match.Slug);
        Assert.Equal("upsert", match.Name);
    }

    [Theory]
    [InlineData(-5, 1)]
    [InlineData(0, 1)]
    [InlineData(3, 3)]
    [InlineData(25, 25)]
    [InlineData(1000, 25)]
    public void Search_keeps_the_limit_between_1_and_25(int limit, int expected)
    {
        // 30 commands that all match "cmd".
        var catalog = Catalog([.. Enumerable.Range(1, 30).Select(i => $"cmd-{i}")]);

        Assert.Equal(expected, CompatibilityTools.SearchCommands(catalog, "cmd", limit).Count);
    }

    [Fact]
    public void Search_defaults_to_10_results()
    {
        var catalog = Catalog([.. Enumerable.Range(1, 30).Select(i => $"cmd-{i}")]);

        Assert.Equal(10, CompatibilityTools.SearchCommands(catalog, "cmd").Count);
    }
}
