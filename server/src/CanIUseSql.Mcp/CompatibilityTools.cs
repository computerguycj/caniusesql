using System.ComponentModel;
using CanIUseSql.Catalog;
using ModelContextProtocol;
using ModelContextProtocol.Server;

namespace CanIUseSql.Mcp;

// The two tools work as a pair: search_commands finds a command's slug,
// check_compatibility looks that slug up. The descriptions are what the model
// reads to decide when and how to call them, so they say that too.
[McpServerToolType]
public static class CompatibilityTools
{
    private const int DefaultLimit = 10;
    private const int MaxLimit = 25;

    // What a model is likely to say, mapped to data.json's dialect keys.
    private static readonly Dictionary<string, string> DialectAliases = new(StringComparer.OrdinalIgnoreCase)
    {
        ["postgres"] = "postgresql",
        ["mssql"] = "sqlserver",
        ["tsql"] = "sqlserver",
    };

    [McpServerTool(Name = "search_commands", ReadOnly = true)]
    [Description(
        "Search the SQL compatibility catalog for a command, clause, function or feature " +
        "(for example \"upsert\", \"CTE\", \"window functions\", \"json\"). Returns matching entries " +
        "with their slug. Call this first, then pass a slug to check_compatibility.")]
    public static IReadOnlyList<CommandMatch> SearchCommands(
        CommandCatalog catalog,
        [Description("One or more keywords. Every keyword must match. Use short SQL terms, not sentences.")]
        string query,
        [Description("Maximum number of results, 1 to 25. Defaults to 10.")]
        int limit = DefaultLimit)
        => catalog.Search(query, Math.Clamp(limit, 1, MaxLimit));

    [McpServerTool(Name = "check_compatibility", ReadOnly = true)]
    [Description(
        "Report whether a SQL command or feature is supported in MySQL, PostgreSQL, SQL Server, " +
        "Oracle and SQLite: since which version, dialect-specific syntax, notes, and a workaround " +
        "where one exists. Takes a slug from search_commands.")]
    public static CompatibilityReport CheckCompatibility(
        CommandCatalog catalog,
        [Description("The command's slug, exactly as search_commands returned it, for example \"with-cte\".")]
        string slug,
        [Description(
            "Dialects to report on: any of mysql, postgresql, sqlserver, oracle, sqlite. " +
            "Leave out to get all of them.")]
        string[]? dialects = null)
    {
        if (!catalog.TryGet(slug, out var command))
            throw new McpException($"No command has the slug '{slug}'. Call search_commands to find the right slug.");

        var all = command!.Compatibility;
        var chosen = all;
        if (dialects is { Length: > 0 })
        {
            var picked = new Dictionary<string, DialectSupport>();
            foreach (var requested in dialects)
            {
                var key = NormalizeDialect(requested);
                if (!all.TryGetValue(key, out var support))
                    throw new McpException(
                        $"Unknown dialect '{requested}'. Valid dialects: {string.Join(", ", all.Keys)}.");
                picked[key] = support;
            }
            chosen = picked;
        }

        return new CompatibilityReport(command.Name, command.Slug, command.Category, command.Description, command.Syntax, chosen);
    }

    // "SQL Server", "sql-server" and "sqlserver" are the same dialect.
    private static string NormalizeDialect(string dialect)
    {
        var key = dialect.Replace(" ", "").Replace("-", "").Replace("_", "").ToLowerInvariant();
        return DialectAliases.GetValueOrDefault(key, key);
    }
}

// check_compatibility's result: the command, and support per requested dialect.
public sealed record CompatibilityReport(
    string Name,
    string Slug,
    string Category,
    string Description,
    string Syntax,
    IReadOnlyDictionary<string, DialectSupport> Compatibility);
