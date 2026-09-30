using System.Text.Json;
using System.Text.RegularExpressions;

namespace CanIUseSql.Api.Catalog;

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

    private CommandCatalog(OrderedDictionary<string, Command> commands)
    {
        All = commands;
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
        return new CommandCatalog(commands);
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

    [GeneratedRegex(SlugPattern)]
    private static partial Regex SlugRegex();
}
