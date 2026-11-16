using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace CanIUseSql.Catalog;

/// <summary>
/// The command data, loaded once from data.json and read-only afterwards.
/// Registered as a singleton and resolved at startup, so a missing or
/// malformed file stops the app before it serves anything.
/// </summary>
public sealed partial class CommandCatalog
{
    // The site's slug format (generate.js builds /f/{slug}/ from these).
    // Shared with the route's validation attribute, so it must be a const.
    public const string SlugPattern = "^[a-z0-9]+(-[a-z0-9]+)*$";
    public const int SlugMaxLength = 64;

    // Strict on the way in: an unknown key, a missing required key, or a null
    // where the record says non-null is an error, not something to drop.
    private static readonly JsonSerializerOptions ReadOptions = new(JsonSerializerDefaults.Web)
    {
        PropertyNameCaseInsensitive = false,
        UnmappedMemberHandling = System.Text.Json.Serialization.JsonUnmappedMemberHandling.Disallow,
        RespectNullableAnnotations = true,
        RespectRequiredConstructorParameters = true,
    };

    private readonly Dictionary<string, string> _nameBySlug;

    /// <summary>Every command, keyed by name, in data.json order.</summary>
    public IReadOnlyDictionary<string, Command> All { get; }

    /// <summary>Name -> slug and description, in data.json order. Built once.</summary>
    public IReadOnlyDictionary<string, CommandSummary> Index { get; }

    /// <summary>
    /// SHA-256 of data.json, hex. Every response is derived from this data
    /// alone, so it identifies the version of all of them (the ETag).
    /// </summary>
    public string Version { get; }

    private CommandCatalog(OrderedDictionary<string, Command> commands, string version)
    {
        All = commands;
        Version = version;
        var index = new OrderedDictionary<string, CommandSummary>(StringComparer.Ordinal);
        foreach (var (name, command) in commands)
            index.Add(name, new CommandSummary(command.Slug, command.Description));
        Index = index;
        _nameBySlug = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var (name, command) in commands)
        {
            if (command.Slug.Length > SlugMaxLength || !SlugRegex().IsMatch(command.Slug))
                throw new InvalidDataException($"Command '{name}' has an invalid slug '{command.Slug}'.");
            if (!_nameBySlug.TryAdd(command.Slug, name))
                throw new InvalidDataException($"Slug '{command.Slug}' is used by '{_nameBySlug[command.Slug]}' and '{name}'.");
        }
    }

    public static CommandCatalog Load(string path) => Parse(File.ReadAllText(path));

    public static CommandCatalog Parse(string json)
    {
        var commands = JsonSerializer.Deserialize<OrderedDictionary<string, Command>>(json, ReadOptions)
            ?? throw new InvalidDataException("data.json is null.");
        var version = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(json)));
        return new CommandCatalog(commands, version);
    }

    public bool TryGet(string slug, out NamedCommand? command)
    {
        if (_nameBySlug.TryGetValue(slug, out var name))
        {
            command = NamedCommand.From(name, All[name]);
            return true;
        }
        command = null;
        return false;
    }

    /// <summary>
    /// Commands matching every word of the query, best match first. A word
    /// matches if a word in the name, slug, category, description or
    /// overview starts with it, ignoring case; the name and slug count most. Ties keep
    /// data.json order.
    /// </summary>
    public IReadOnlyList<CommandMatch> Search(string query, int limit)
    {
        var words = WordRegex().Matches(query).Select(m => m.Value).ToArray();
        if (words.Length == 0 || limit <= 0)
            return [];

        var matches = new List<(int Score, CommandMatch Match)>();
        foreach (var (name, command) in All)
        {
            var score = 0;
            foreach (var word in words)
            {
                var wordScore = WordScore(word, name, command);
                if (wordScore == 0)
                {
                    score = 0;
                    break;
                }
                score += wordScore;
            }
            if (score > 0)
                matches.Add((score, new CommandMatch(name, command.Slug, command.Category, command.Description)));
        }
        // OrderByDescending is stable, so equal scores stay in data.json order.
        return [.. matches.OrderByDescending(m => m.Score).Take(limit).Select(m => m.Match)];
    }

    private static int WordScore(string word, string name, Command command)
    {
        if (Has(name, word) || Has(command.Slug, word)) return 10;
        if (Has(command.Category, word)) return 3;
        if (Has(command.Description, word)) return 2;
        if (Has(command.Overview, word)) return 1;
        return 0;

        // True if some word in the text starts with this one: "cte" finds
        // "CTEs" and "with-cte" but not "character".
        static bool Has(string text, string word)
        {
            for (var at = 0; (at = text.IndexOf(word, at, StringComparison.OrdinalIgnoreCase)) >= 0; at++)
            {
                if (at == 0 || !char.IsAsciiLetterOrDigit(text[at - 1]))
                    return true;
            }
            return false;
        }
    }

    [GeneratedRegex(SlugPattern)]
    private static partial Regex SlugRegex();

    [GeneratedRegex("[A-Za-z0-9]+")]
    private static partial Regex WordRegex();
}
