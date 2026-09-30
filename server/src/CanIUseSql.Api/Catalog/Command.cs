namespace CanIUseSql.Api.Catalog;

// One entry in data.json, keyed there by the command's name. Property names
// serialize camelCase, which matches data.json's keys exactly.
public sealed record Command(
    string Description,
    string Syntax,
    string Category,
    string Slug,
    IReadOnlyDictionary<string, DialectSupport> Compatibility,
    string Details,
    string Overview);

// data.json omits `since` and `syntax` on some dialects and sets them to null
// on others. Both load as null, and the API always writes the key.
public sealed record DialectSupport(
    bool Supported,
    string Notes,
    bool Native,
    Workaround? Workaround,
    string? Since = null,
    string? Syntax = null);

public sealed record Workaround(string Description, string Since, string Syntax);

// GET /api/v2/commands/{slug}: the entry plus its name, which data.json only
// has as the key.
public sealed record NamedCommand(
    string Name,
    string Description,
    string Syntax,
    string Category,
    string Slug,
    IReadOnlyDictionary<string, DialectSupport> Compatibility,
    string Details,
    string Overview)
{
    public static NamedCommand From(string name, Command c) =>
        new(name, c.Description, c.Syntax, c.Category, c.Slug, c.Compatibility, c.Details, c.Overview);
}

// GET /api/v2/command-index: just what the search box needs, per command.
public sealed record CommandSummary(string Slug, string Description);
