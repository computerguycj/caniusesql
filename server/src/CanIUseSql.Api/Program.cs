// CanIUseSql.Api: read-only JSON API for the SQL compatibility data.
// Controllers with attribute routing under /api/v2. The front end reaches it
// through a Vercel rewrite, so browsers see it on the site's own origin.
using System.Net;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Threading.RateLimiting;
using CanIUseSql.Api.Catalog;
using CanIUseSql.Api.Filters;
using CanIUseSql.Api.RateLimiting;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

var builder = WebApplication.CreateBuilder(args);

// data.json is copied next to the app at build time (see the .csproj).
// Catalog:Path overrides it, e.g. in tests.
builder.Services.AddSingleton(sp =>
{
    var path = sp.GetRequiredService<IConfiguration>()["Catalog:Path"]
        ?? Path.Combine(AppContext.BaseDirectory, "data.json");
    return CommandCatalog.Load(path);
});
builder.Services.AddSingleton<CatalogCacheFilter>();  // for [ServiceFilter]

// Client IP: take only the rightmost X-Forwarded-For entry, the one the
// proxy directly in front wrote, and only on connections from that proxy.
// Anything further left was written by someone we can't verify.
builder.Services.AddOptions<ForwardedHeadersSettings>().BindConfiguration(ForwardedHeadersSettings.Section);
builder.Services.AddOptions<ForwardedHeadersOptions>()
    .Configure<IOptions<ForwardedHeadersSettings>>((options, settings) =>
    {
        options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
        options.ForwardLimit = 1;
        options.KnownProxies.Clear();
        options.KnownIPNetworks.Clear();  // drop the loopback default; config decides
        foreach (var cidr in settings.Value.TrustedNetworks)
            options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(cidr));
    });

// Fixed window per client IP, on the command endpoints only
// ([EnableRateLimiting]). Over the limit: 429 problem+json with Retry-After.
builder.Services.AddOptions<RateLimitSettings>().BindConfiguration(RateLimitSettings.Section);
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy(RateLimitSettings.PolicyName, context =>
    {
        var settings = context.RequestServices.GetRequiredService<IOptions<RateLimitSettings>>().Value;
        var ip = context.Connection.RemoteIpAddress ?? IPAddress.None;
        return RateLimitPartition.GetFixedWindowLimiter(ip.ToString(), _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = settings.PermitLimit,
            Window = TimeSpan.FromSeconds(settings.WindowSeconds),
            QueueLimit = 0,
        });
    });
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        if (context.Lease.TryGetMetadata(MetadataName.RetryAfter, out var retryAfter))
            context.HttpContext.Response.Headers.RetryAfter = ((int)Math.Ceiling(retryAfter.TotalSeconds)).ToString();
        await context.HttpContext.RequestServices.GetRequiredService<IProblemDetailsService>().WriteAsync(new()
        {
            HttpContext = context.HttpContext,
            ProblemDetails = { Status = StatusCodes.Status429TooManyRequests, Title = "Too many requests" },
        });
    };
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
    // (<) so the JSON is inert even if something mistakes it for HTML.
    json.Encoder = JavaScriptEncoder.Default;
});

var app = builder.Build();

// Fail fast: load the catalog now, not on the first request.
app.Services.GetRequiredService<CommandCatalog>();

// First, so everything after it (the rate limiter, logs) sees the client IP.
app.UseForwardedHeaders();
app.UseExceptionHandler();
app.UseStatusCodePages();
app.UseRateLimiter();
app.MapControllers();
app.Run();

// Lets WebApplicationFactory<Program> in the test project find this entry point.
public partial class Program;
