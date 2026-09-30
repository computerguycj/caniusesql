// CanIUseSql.Api: read-only JSON API for the SQL compatibility data.
// Controllers with attribute routing under /api/v2. The front end reaches it
// through a Vercel rewrite, so browsers see it on the site's own origin.
using System.Text.Encodings.Web;
using System.Text.Json;
using CanIUseSql.Api.Catalog;

var builder = WebApplication.CreateBuilder(args);

// data.json is copied next to the app at build time (see the .csproj).
// Catalog:Path overrides it, e.g. in tests.
builder.Services.AddSingleton(sp =>
{
    var path = sp.GetRequiredService<IConfiguration>()["Catalog:Path"]
        ?? Path.Combine(AppContext.BaseDirectory, "data.json");
    return CommandCatalog.Load(path);
});

// Errors come back as application/problem+json (RFC 9457): 404s from
// controllers, bare status codes with no body, and unhandled exceptions,
// which get a generic 500 with no stack trace.
builder.Services.AddProblemDetails();
builder.Services.AddControllers().AddJsonOptions(options =>
{
    var json = options.JsonSerializerOptions;
    // data.json's keys are camelCase, so the records' PascalCase properties
    // map onto them exactly. Command names are dictionary keys: with no
    // DictionaryKeyPolicy they're written as-is ("with (common table expressions)").
    json.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    json.DictionaryKeyPolicy = null;
    // MVC falls back to UnsafeRelaxedJsonEscaping when no encoder is set, which
    // writes <, > and & raw. Some descriptions hold HTML-like text; escape it
    // (\u003C) so the JSON is inert even if something mistakes it for HTML.
    json.Encoder = JavaScriptEncoder.Default;
});

var app = builder.Build();

// Fail fast: load the catalog now, not on the first request.
app.Services.GetRequiredService<CommandCatalog>();

app.UseExceptionHandler();
app.UseStatusCodePages();
app.MapControllers();
app.Run();

// Lets WebApplicationFactory<Program> in the test project find this entry point.
public partial class Program;
